//! Publication composition root with signal handling installed before Git work.

use std::env;
use std::process::ExitCode;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use async_trait::async_trait;
use mokly_cli::codes::Code;
use mokly_cli::grammar;
use mokly_cli::output::Style;
use mokly_cli::publication::build::SystemDirectories;
use mokly_cli::publication::command::{Command, Options, Publish};
use mokly_cli::publication::error::Error;
use mokly_cli::publish_errors::render;
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_cli::version::VERSION;
use mokly_git::control;
use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;
use mokly_publish::accounting::Receipt;
use mokly_publish::checkout::GitCheckout;
use mokly_publish::error;
use mokly_publish::exchange::{Client, Exchange};
use mokly_publish::hints::SystemOutputHints;
use mokly_publish::http::ReqwestHttp;
use mokly_publish::identity::ActionsContext;
use mokly_publish::runtime::Cancellation;
use mokly_publish::runtime::{CommandCancellation, SystemClock};
use mokly_publish::settings::Settings;
use mokly_publish::snapshot::Prepared;
use mokly_sidecar::pool::SidecarPool;

use crate::one_shot::Lines;
use crate::publication_runtime;
use crate::terminal::Terminal;

pub(super) fn run(
    publish: &grammar::Publish,
    style: &Style,
    redactor: Arc<Redactor>,
    terminal: Arc<dyn Terminal>,
) -> ExitCode {
    let started = Instant::now();
    let lines = Arc::new(Lines::new(
        style.clone(),
        redactor.clone(),
        terminal.clone(),
    ));
    let cancellation = CommandCancellation::default();
    let pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>> = Arc::new(Mutex::new(None));
    let settings = match Settings::new(
        publish.endpoint.as_deref().unwrap_or_default(),
        publish.token.clone().unwrap_or_default(),
        publish.upload_concurrency,
    ) {
        Ok(settings) => settings,
        Err(error) => {
            terminal.stderr(&render(&error, style, &redactor));
            return ExitCode::FAILURE;
        }
    };
    let directory = match env::current_dir() {
        Ok(directory) => directory,
        Err(_) => {
            terminal.stderr(&style.error(
                Code::GitFailed,
                "The working directory could not be read.",
                &redactor,
            ));
            return ExitCode::FAILURE;
        }
    };
    let options = Options {
        directory,
        version: VERSION.to_owned(),
        repository: publish.repository.clone(),
        actions: ActionsContext {
            actions: env::var("GITHUB_ACTIONS").ok(),
            head_ref: env::var("GITHUB_HEAD_REF").ok(),
            ref_type: env::var("GITHUB_REF_TYPE").ok(),
            ref_name: env::var("GITHUB_REF_NAME").ok(),
            git_ref: env::var("GITHUB_REF").ok(),
        },
        config: publication_runtime::config(&publish.common.config),
        base: publish.common.base.clone(),
        no_changes: publish.no_changes,
        strict: publish.strict,
        owned_paths: Vec::new(),
    };
    let http = match ReqwestHttp::new() {
        Ok(http) => http,
        Err(_) => {
            terminal.stderr(&style.error(Code::UploadTransport, "", &redactor));
            return ExitCode::FAILURE;
        }
    };
    let command: &dyn Publish = &Command {
        checkout: Arc::new(GitCheckout {
            hints: Arc::new(SystemOutputHints),
            runner: Arc::new(SystemRunner {
                clock: Arc::new(control::SystemClock::default()),
                cancellation: Arc::new(control::Token::default()),
                groups: Arc::new(SystemProcessGroups),
            }),
        }),
        directories: Arc::new(SystemDirectories),
        output: Arc::new(publication_runtime::Output {
            common: publish.common.clone(),
            cancellation: cancellation.clone(),
            pool: pool.clone(),
            phases: lines.clone(),
        }),
        reporter: lines.clone(),
        exchange: Arc::new(Uploading {
            phases: lines.clone(),
            exchange: Arc::new(Client {
                http: Arc::new(http),
                clock: Arc::new(SystemClock),
                reporter: lines.clone(),
            }),
        }),
    };
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(_) => {
            terminal.stderr(&style.error(
                Code::UploadFailed,
                "The publication runtime could not start.",
                &redactor,
            ));
            return ExitCode::FAILURE;
        }
    };
    let result = runtime.block_on(async {
        let signals = signals(cancellation.clone(), pool.clone());
        let handle = match signals {
            Ok(handle) => handle,
            Err(_) => {
                return Err(Error::Exchange {
                    source: error::Error::Failed,
                });
            }
        };
        let result = command.run(&options, &settings, &cancellation).await;
        handle.abort();
        result
    });
    lines.clear();
    match result {
        Ok(receipt) => {
            lines.published(&receipt, started.elapsed());
            ExitCode::SUCCESS
        }
        Err(error) => {
            terminal.stderr(&mokly_cli::publish_errors::command(
                &error, style, &redactor,
            ));
            ExitCode::FAILURE
        }
    }
}

fn signals(
    cancellation: CommandCancellation,
    pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>>,
) -> std::io::Result<tokio::task::JoinHandle<()>> {
    #[cfg(unix)]
    {
        let mut interrupt =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())?;
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        Ok(tokio::spawn(async move {
            tokio::select! { _ = interrupt.recv() => {}, _ = terminate.recv() => {} }
            cancellation.token.cancel();
            stop_pool(pool).await;
        }))
    }
    #[cfg(not(unix))]
    {
        Ok(tokio::spawn(async move {
            if tokio::signal::ctrl_c().await.is_ok() {
                cancellation.token.cancel();
                stop_pool(pool).await;
            }
        }))
    }
}

async fn stop_pool(pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>>) {
    let _ = tokio::task::spawn_blocking(move || {
        let pool = pool
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        if let Some(pool) = pool {
            let _ = pool.shutdown();
        }
    })
    .await;
}

struct Uploading {
    phases: Arc<dyn Phases>,
    exchange: Arc<dyn Exchange>,
}
#[async_trait]
impl Exchange for Uploading {
    async fn publish(
        &self,
        prepared: &Prepared,
        settings: &Settings,
        cancellation: &dyn Cancellation,
    ) -> error::Result<Receipt> {
        self.phases.start(Phase::Uploading);
        self.exchange
            .publish(prepared, settings, cancellation)
            .await
    }
}
