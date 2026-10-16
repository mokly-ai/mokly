//! Publication composition root with signal handling installed before Git work.

use std::env;
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use mokly_cli::codes::Code;
use mokly_cli::grammar;
use mokly_cli::output::Style;
use mokly_cli::publication::build::SystemDirectories;
use mokly_cli::publication::command::{Command, Options, Publish};
use mokly_cli::publication_signals::PublicationSignals;
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
use mokly_publish::runtime::SystemClock;
use mokly_publish::settings::Settings;
use mokly_publish::snapshot::Prepared;

use crate::interrupts::Interrupts;
use crate::one_shot::Lines;
use crate::publication_runtime;
use crate::terminal::Terminal;
use crate::{command_diagnostics, serve_trace};

pub(super) fn run(
    publish: &grammar::Publish,
    style: &Style,
    redactor: Arc<Redactor>,
    terminal: Arc<dyn Terminal>,
) -> ExitCode {
    if publish.common.debug_timings {
        serve_trace::install(terminal.clone(), format!("publish-{}", std::process::id()));
    }
    let timing = tracing::info_span!("publish", status = "error").entered();
    let started = Instant::now();
    let interrupts = match Interrupts::publish() {
        Ok(interrupts) => interrupts,
        Err(error) => {
            terminal.stderr(&style.error(Code::UploadFailed, &error.to_string(), &redactor));
            return ExitCode::FAILURE;
        }
    };
    let cancellation = PublicationSignals {
        signals: interrupts.cancellation.clone(),
        token: interrupts.publication.clone(),
    };
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
    let lines = Arc::new(Lines::new(
        style.clone(),
        redactor.clone(),
        terminal.clone(),
        directory.clone(),
    ));
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
            terminal: terminal.clone(),
            style: style.clone(),
            redactor: redactor.clone(),
            common: publish.common.clone(),
            cancellation: interrupts.cancellation.clone(),
            pool: interrupts.pool.clone(),
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
    let result = runtime.block_on(command.run(&options, &settings, &cancellation));
    lines.clear();
    match result {
        Ok(receipt) => {
            timing.record("status", "ok");
            lines.published(&receipt, started.elapsed());
            ExitCode::SUCCESS
        }
        Err(error) => {
            terminal.stderr(&mokly_cli::publish_errors::command(
                &error,
                style,
                &redactor,
                &options.directory,
            ));
            command_diagnostics::emit(&error, terminal.as_ref(), &redactor);
            ExitCode::FAILURE
        }
    }
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
