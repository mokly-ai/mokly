//! Publication composition root with signal handling installed before Git work.

use std::env;
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;

use mokly_cli::codes::Code;
use mokly_cli::grammar;
use mokly_cli::output::Style;
use mokly_cli::publication::build::{SystemDirectories, UnavailableOutput};
use mokly_cli::publication::command::{BuildReporter, Command, Options, Publish};
use mokly_cli::publish_errors::render;
use mokly_cli::redaction::Redactor;
use mokly_cli::version::VERSION;
use mokly_git::control;
use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;
use mokly_publish::checkout::GitCheckout;
use mokly_publish::exchange::Client;
use mokly_publish::hints::SystemOutputHints;
use mokly_publish::http::ReqwestHttp;
use mokly_publish::identity::ActionsContext;
use mokly_publish::runtime::{CommandCancellation, SilentReporter, SystemClock};
use mokly_publish::settings::Settings;

use crate::terminal::{SystemTerminal, Terminal};

struct BuildLines {
    redactor: Arc<Redactor>,
}

impl BuildReporter for BuildLines {
    fn build_directory(&self, directory: &std::path::Path) {
        SystemTerminal::default().stdout(&format!(
            "Mokly publish build: {}\n",
            self.redactor.safe(&directory.to_string_lossy())
        ));
    }
}

pub(super) fn run(
    publish: &grammar::Publish,
    style: &Style,
    redactor: Arc<Redactor>,
    terminal: &dyn Terminal,
) -> ExitCode {
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
        config: publish.common.config.as_ref().map(PathBuf::from),
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
        output: Arc::new(UnavailableOutput),
        reporter: Arc::new(BuildLines {
            redactor: Arc::clone(&redactor),
        }),
        exchange: Arc::new(Client {
            http: Arc::new(http),
            clock: Arc::new(SystemClock),
            reporter: Arc::new(SilentReporter),
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
        let cancellation = CommandCancellation::default();
        let signals = signals(cancellation.clone());
        let handle = match signals {
            Ok(handle) => handle,
            Err(_) => return Err(mokly_publish::error::Error::Failed),
        };
        let result = command.run(&options, &settings, &cancellation).await;
        handle.abort();
        result
    });
    match result {
        Ok(receipt) => {
            terminal.stdout(&format!("{}\n", receipt.summary()));
            if let Some(url) = receipt.completion.viewer_url {
                terminal.stdout(&format!("{}\n", redactor.safe(&url)));
            }
            ExitCode::SUCCESS
        }
        Err(error) => {
            terminal.stderr(&render(&error, style, &redactor));
            ExitCode::FAILURE
        }
    }
}

fn signals(cancellation: CommandCancellation) -> std::io::Result<tokio::task::JoinHandle<()>> {
    #[cfg(unix)]
    {
        let mut interrupt =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())?;
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        Ok(tokio::spawn(async move {
            tokio::select! { _ = interrupt.recv() => {}, _ = terminate.recv() => {} }
            cancellation.token.cancel();
        }))
    }
    #[cfg(not(unix))]
    {
        Ok(tokio::spawn(async move {
            if tokio::signal::ctrl_c().await.is_ok() {
                cancellation.token.cancel();
            }
        }))
    }
}
