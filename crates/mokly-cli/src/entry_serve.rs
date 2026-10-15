//! Serve composition root: validate, install signals, reserve the URL, and close.

use std::env;
use std::io::IsTerminal;
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_cli::build_output;
use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::codes::Code;
use mokly_cli::grammar::{Common, Serve};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::{serve_errors, serve_output};
use mokly_server::application::Application;
use mokly_server::assets::{PackageAssets, ViewerAssets};
use mokly_server::background::{Background, UsagePass};
use mokly_server::clock::MonotonicClock;
use mokly_server::entropy::{Entropy, RandomEntropy};
use mokly_server::error::{InternalError, ServerError};
use mokly_server::preview::MemoryPreviews;
use mokly_server::publication::SharedPublication;
use mokly_server::runtime::{ServerRuntime, TokioServer};
use mokly_server::shutdown::FixedLifecycle;
use mokly_server::snapshot::Projector;
use mokly_server::work::{Workers, parallelism};
use tokio::sync::{mpsc, watch};

use crate::serve_candidates::ManualCandidates;
use crate::serve_rebuild::{ManualRebuilds, ServeActions};
use crate::serve_reporter::ServeLines;
use crate::serve_services::ServeServices;
use crate::serve_state::{NativeServeState, ServeStateFactory};
use crate::serve_timing::ServeTiming;
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
    if common.debug_timings && !serve_trace::install(terminal.clone(), entropy.secret()) {
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
    let services = match ServeServices::new(&cwd, common, redactor.clone(), cancellation.clone()) {
        Ok(services) => services,
        Err(error) => {
            terminal.stderr(&build_output::failure(style, &error, &redactor));
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
        let shutdown = serve_shutdown::start(
            receiver.clone(),
            cancellation.clone(),
            services.pool.clone(),
        );
        let result = async {
            let watching: Option<Arc<dyn WatchInputs>> = if options.no_watch {
                None
            } else {
                match WatchedInputs::new(tree.clone(), &services.config) {
                    Ok(watching) => Some(Arc::new(watching)),
                    Err(_) if *receiver.borrow() => return Ok(ExitCode::SUCCESS),
                    Err(error) => return Err(error),
                }
            };
            let prepared = match serve_preparation::initial(
                preparation.clone(),
                watching.clone(),
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
                    terminal.stderr(&build_output::failure(style, &error, &redactor));
                    return Ok(ExitCode::FAILURE);
                }
                Err(_) if *receiver.borrow() => return Ok(ExitCode::SUCCESS),
                Err(source) => return Err(source),
            };
            if *receiver.borrow() {
                return Ok(ExitCode::SUCCESS);
            }
            let assets: &dyn ViewerAssets = &PackageAssets { tree: tree.clone() };
            let dist = viewer_dist().ok_or(ServerError::InvalidAssets)?;
            let states: Arc<dyn ServeStateFactory> = Arc::new(NativeServeState {
                tree: tree.clone(),
                projector: Arc::new(Projector {
                    deployment_id: entropy.secret(),
                    render_token: entropy.secret(),
                }),
                assets: assets.load(&dist)?,
                base: common.base.clone(),
            });
            let snapshot = states.create(&prepared, 1)?;
            let base = snapshot.index.base.clone().unwrap_or_default();
            let publications = Arc::new(SharedPublication::new(snapshot));
            let reporter = Arc::new(ServeLines {
                cancellation: cancellation.clone(),
                terminal: terminal.clone(),
                style: style.clone(),
                redactor: redactor.clone(),
            });
            let work = Arc::new(Workers::new(workers, reporter.clone()));
            let background: Arc<dyn Background> = Arc::new(UsagePass {
                publications: publications.clone(),
                work: work.clone(),
                diagnostics: reporter.clone(),
            });
            let app = Arc::new(Application::new(
                publications.clone(),
                Arc::new(MemoryPreviews::new(
                    Arc::new(MonotonicClock::default()),
                    entropy.secret(),
                )),
                work,
                reporter.clone(),
            ));
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
            terminal.stdout(&layout);
            terminal.stderr(&build_output::warnings(
                style,
                &prepared.summary.warnings,
                &redactor,
            ));
            terminal.stdout(&serve_output::catalogue(
                style,
                &prepared.summary,
                timing.elapsed(),
            ));
            terminal.stdout(&serve_output::changes_unavailable(
                style,
                "Git comparison is unavailable in this build.",
                &redactor,
            ));
            timing.ready();
            if options.open {
                serve_controls::open(&url, style, &redactor, terminal.as_ref());
            }
            let lifecycle: Arc<dyn mokly_server::shutdown::Lifecycle> =
                watching.clone().map_or_else(
                    || Arc::new(FixedLifecycle) as Arc<dyn mokly_server::shutdown::Lifecycle>,
                    |watching| watching as Arc<dyn mokly_server::shutdown::Lifecycle>,
                );
            let candidates = Arc::new(ManualCandidates::new(lifecycle));
            let (rebuild, requests) = mpsc::channel(1);
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
                watching,
                candidates: candidates.clone(),
                preparation: preparation.clone(),
                states,
                publications: publications.clone(),
                writer: publications,
                reporter,
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
        stop.send_replace(true);
        let shutdown = shutdown.await;
        signals.abort();
        serve_shutdown::finish(shutdown)?;
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

fn viewer_dist() -> Option<PathBuf> {
    if let Some(path) = env::var_os("MOKLY_VIEWER_DIST") {
        return Some(PathBuf::from(path));
    }
    let executable = env::current_exe().ok()?;
    executable
        .ancestors()
        .skip(1)
        .flat_map(|parent| {
            [
                parent.join("viewer/dist"),
                parent.join("packages/viewer/dist"),
            ]
        })
        .find(|path| path.join("browser.manifest.json").is_file())
}
