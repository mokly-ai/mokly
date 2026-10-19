//! Serve composition root: validate, install signals, reserve the URL, and close.

use std::env;
use std::io::IsTerminal;
use std::process::ExitCode;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config::relative;
use mokly_cli::build_output;
use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::codes::Code;
use mokly_cli::grammar::{Common, Serve};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::{serve_errors, serve_output};
use mokly_server::entropy::{Entropy, RandomEntropy};
use mokly_server::error::{InternalError, ServerError};
use mokly_server::runtime::{ServerRuntime, TokioServer};
use mokly_server::work::parallelism;
use tokio::sync::{mpsc, watch};

use crate::serve_candidates::{CandidateWork, ManualCandidates};
use crate::serve_delivery::{self, StateInputs};
use crate::serve_git::{ServeGit, SystemRunners};
use crate::serve_lifecycle::ServeLifecycle;
use crate::serve_progress::{Progress, ServeProgress};
use crate::serve_rebuild::{ManualRebuilds, ServeActions};
use crate::serve_reporter::ServeLines;
use crate::serve_services::ServeServices;
use crate::serve_timing::ServeTiming;
use crate::serve_warnings::{ServeWarnings, WarningScopes};
use crate::serve_watch::{WatchInputs, WatchedInputs};
use crate::terminal::Terminal;
use crate::{serve_controls, serve_preparation, serve_shutdown, serve_signals, serve_trace};

pub(super) fn run(
    common: &Common,
    options: &Serve,
    style: &Style,
    redactor: Arc<Redactor>,
    terminal: Arc<dyn Terminal>,
) -> ExitCode {
    let entropy: Arc<dyn Entropy> = Arc::new(RandomEntropy);
    if common.debug_timings
        && !serve_trace::install(terminal.clone(), entropy.secret(), redactor.clone())
    {
        terminal.stderr(&style.error(
            Code::ServerFailed,
            "Timing diagnostics could not start.",
            &redactor,
        ));
        return ExitCode::FAILURE;
    }
    let mut timing = ServeTiming::new();
    let cwd = match env::current_dir() {
        Ok(cwd) => cwd,
        Err(error) => {
            terminal.stderr(&style.error(Code::ConfigInvalid, &error.to_string(), &redactor));
            return ExitCode::FAILURE;
        }
    };
    let cancellation: Arc<dyn Cancellation> = Arc::new(ServeCancellation::default());
    let progress = Arc::new(ServeProgress::new(
        style.clone(),
        terminal,
        cancellation.clone(),
        std::io::stdout().is_terminal(),
    ));
    let diagnostics = progress.clone().diagnostics(redactor.clone());
    let terminal: Arc<dyn Terminal> = progress.clone();
    let progress: Arc<dyn Progress> = progress;
    let warnings: Arc<dyn WarningScopes> = Arc::new(ServeWarnings::new(
        cancellation.clone(),
        terminal.clone(),
        style.clone(),
        redactor.clone(),
    ));
    let attempt = warnings.begin();
    let (rebuild, requests) = mpsc::channel(1);
    let reporter = Arc::new(ServeLines {
        rebuild: (!options.no_watch).then(|| rebuild.clone()),
        cwd: cwd.clone(),
        cancellation: cancellation.clone(),
        terminal: terminal.clone(),
        style: style.clone(),
        redactor: redactor.clone(),
    });
    let services = match ServeServices::new(&cwd, common, diagnostics, cancellation.clone()) {
        Ok(services) => services,
        Err(error) => {
            reporter.preparation_failed(attempt.as_ref(), &error);
            return ExitCode::FAILURE;
        }
    };
    let tree = services.tree.clone();
    let preparation = services.preparation.clone();
    let workers = parallelism(std::thread::available_parallelism().map_or(1, usize::from));
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .worker_threads(workers as usize)
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            terminal.stderr(&style.error(Code::ServerFailed, &error.to_string(), &redactor));
            return ExitCode::FAILURE;
        }
    };
    let result = runtime.block_on(async {
        let (stop, receiver) = watch::channel(false);
        let signals = match serve_signals::install(stop.clone()) {
            Ok(signals) => signals,
            Err(source) => return Err(ServerError::Internal(InternalError::Io { source })),
        };
        let animation = {
            let progress = progress.clone();
            let stopped = receiver.clone();
            tokio::spawn(async move {
                progress.animate(stopped).await;
            })
        };
        let phase = Arc::new(serve_shutdown::Phase::default());
        let git = Arc::new(ServeGit::new(Arc::new(SystemRunners)));
        let lifecycle = Arc::new(ServeLifecycle {
            git: git.clone(),
            watch: Mutex::new(None),
            cancellation: cancellation.clone(),
            pool: services.pool.clone(),
        });
        let candidates = Arc::new(ManualCandidates::new(lifecycle.clone()));
        let shutdown = serve_shutdown::start(receiver.clone(), candidates.clone(), phase.clone());
        let mut reserved = None;
        let result = async {
            let watching: Option<Arc<dyn WatchInputs>> = {
                let mut slot = lifecycle
                    .watch
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                if !phase.starting() || *receiver.borrow() {
                    return Ok(ExitCode::SUCCESS);
                }
                let watching: Option<Arc<dyn WatchInputs>> = if options.no_watch {
                    None
                } else {
                    Some(Arc::new(WatchedInputs::new(
                        tree.clone(),
                        &services.config,
                    )?))
                };
                *slot = watching.clone();
                watching
            };
            let Some(preparing) = candidates.enter() else {
                return Ok(ExitCode::SUCCESS);
            };
            let prepared = match serve_preparation::initial(
                preparation.clone(),
                watching.clone(),
                attempt.clone(),
                &cwd,
                common,
            )
            .await
            {
                Ok(Ok(prepared)) => prepared,
                Ok(Err(error)) => {
                    if *receiver.borrow() {
                        return Ok(ExitCode::SUCCESS);
                    }
                    reporter.preparation_failed(attempt.as_ref(), &error);
                    return Ok(ExitCode::FAILURE);
                }
                Err(_) if *receiver.borrow() => return Ok(ExitCode::SUCCESS),
                Err(source) => return Err(source),
            };
            drop(preparing);
            if *receiver.borrow() {
                return Ok(ExitCode::SUCCESS);
            }
            let states = serve_delivery::states(StateInputs {
                services: &services,
                common,
                style,
                entropy: entropy.clone(),
                git,
                warnings: warnings.clone(),
                progress: progress.clone(),
                reporter: reporter.clone(),
                cancellation: cancellation.clone(),
                terminal: terminal.clone(),
                redactor: redactor.clone(),
            })?;
            let snapshot = states.create(&prepared, 1, attempt.clone())?;
            let base = snapshot.index.base.clone().unwrap_or_default();
            let delivery = serve_delivery::create(
                snapshot,
                workers,
                entropy.clone(),
                reporter.clone(),
                !options.no_watch,
                services.sidecars.clone(),
            );
            let publications = delivery.publications;
            let background = delivery.background;
            let app = delivery.app;
            let transport: &dyn ServerRuntime = &TokioServer;
            let server = transport.bind(options.port.unwrap_or(4173)).await?;
            let url = format!("http://{}", server.address());
            let interactive =
                style.mode == Mode::Rich && !options.no_watch && std::io::stdin().is_terminal();
            let layout = serve_output::ready(
                style,
                &url,
                &relative(&prepared.config.file, &prepared.config.repo_root),
                &base,
                !options.no_watch,
                interactive,
                &redactor,
            );
            if *receiver.borrow()
                || !phase.serve(&|| {
                    terminal.stdout(&layout);
                    attempt.finish(&prepared.summary.warnings, false, &|warnings| {
                        terminal.stderr(&build_output::warnings(style, warnings, &redactor));
                        terminal.stdout(&serve_output::catalogue(
                            style,
                            &prepared.summary,
                            timing.elapsed(),
                        ));
                    });
                })
            {
                reserved = Some(server);
                return Ok(ExitCode::SUCCESS);
            }
            timing.ready();
            if options.open {
                serve_controls::open(&url, style, &redactor, terminal.as_ref());
            }
            let controls = serve_controls::start(
                interactive,
                serve_controls::Controls {
                    stop: stop.clone(),
                    rebuild,
                    url,
                    layout,
                    style: style.clone(),
                    redactor: redactor.clone(),
                    terminal: terminal.clone(),
                },
            );
            let actions: &dyn ServeActions = &ManualRebuilds {
                warnings: warnings.clone(),
                watching,
                candidates: candidates.clone(),
                preparation: preparation.clone(),
                states,
                publications: publications.clone(),
                writer: publications,
                reporter: reporter.clone(),
                cwd: cwd.clone(),
                options: common.clone(),
            };
            let background_stop = receiver.clone();
            let background = tokio::spawn(async move {
                background.run(background_stop).await;
            });
            let result = actions
                .run(Box::pin(server.run(app, receiver, candidates)), requests)
                .await;
            stop.send_replace(true);
            let _ = background.await;
            if let Some(controls) = controls {
                let _ = controls.await;
            }
            result.map(|()| ExitCode::SUCCESS)
        }
        .await;
        if result.is_err() {
            reporter.terminating_failure(warnings.as_ref());
        }
        stop.send_replace(true);
        let shutdown = shutdown.await;
        let _ = animation.await;
        signals.abort();
        let finished = serve_shutdown::finish(shutdown);
        drop(reserved);
        finished?;
        result
    });
    match result {
        Ok(status) => status,
        Err(error) => {
            terminal.stderr(&serve_errors::failure(style, &error, &redactor));
            ExitCode::FAILURE
        }
    }
}
