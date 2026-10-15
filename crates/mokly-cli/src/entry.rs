//! Real environment and terminal composition for the mokly binary.

use std::env;
use std::io::{self, IsTerminal, Write};
use std::process::ExitCode;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::Builder;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::{BuildError, BuildService, CatalogueBuild};
use mokly_cli::build_output;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_cli::codes::Code;
use mokly_cli::errors::Failure;
use mokly_cli::grammar::Verb;
use mokly_cli::options::{Environment, validate};
use mokly_cli::output::{Style, select};
use mokly_cli::parsing::{ParseError, parse};
use mokly_cli::redaction::Redactor;
use mokly_cli::version::VERSION;
use mokly_source_interface::tree::SourceTree;
use terminal_size::{Width, terminal_size};

use crate::entry_publish;
use crate::interrupts::Interrupts;

use super::render_runtime::Services;

pub(super) trait Terminal {
    fn stdout(&self, text: &str);
    fn stderr(&self, text: &str);
}

pub(super) struct SystemTerminal;

impl Terminal for SystemTerminal {
    fn stdout(&self, text: &str) {
        let _ = io::stdout().lock().write_all(text.as_bytes());
    }
    fn stderr(&self, text: &str) {
        let _ = io::stderr().lock().write_all(text.as_bytes());
    }
}

pub(super) fn main() -> ExitCode {
    let terminal: &dyn Terminal = &SystemTerminal;
    let arguments: Vec<_> = env::args_os()
        .map(|value| value.to_string_lossy().into_owned())
        .collect();
    let token = env::var("MOKLY_TOKEN").ok();
    let redactor = Arc::new(Redactor::collect(&arguments, token.as_deref()));
    let style = Style {
        mode: select(
            arguments
                .iter()
                .any(|argument| argument == "--debug-timings"),
            env::var("MOKLY_OUTPUT").ok().as_deref(),
            env::var("CI").ok().as_deref(),
            io::stdout().is_terminal(),
        ),
        color: env::var_os("NO_COLOR").is_none()
            && (env::var_os("FORCE_COLOR").is_some()
                || (io::stderr().is_terminal()
                    && env::var("TERM").ok().as_deref() != Some("dumb"))),
        ascii: cfg!(windows)
            && env::var_os("WT_SESSION").is_none()
            && env::var_os("TERM_PROGRAM").is_none()
            && env::var_os("TERM").is_none(),
        columns: terminal_size().map_or(
            80,
            |(Width(width), _)| if width > 0 { usize::from(width) } else { 80 },
        ),
    };
    let mut cli = match parse(&arguments) {
        Ok(cli) => cli,
        Err(ParseError::Help(help)) => {
            terminal.stdout(&help);
            return ExitCode::SUCCESS;
        }
        Err(ParseError::Version) => {
            terminal.stdout(&format!("{VERSION}\n"));
            return ExitCode::SUCCESS;
        }
        Err(ParseError::Invalid(failure)) => {
            terminal.stderr(&style.failure(&failure, &redactor));
            return ExitCode::FAILURE;
        }
    };
    let environment = Environment {
        sidecars: env::var("MOKLY_SIDECARS").ok(),
        sidecar_timeout_ms: env::var("MOKLY_SIDECAR_TIMEOUT_MS").ok(),
        endpoint: env::var("MOKLY_ENDPOINT").ok(),
        token,
        cores: std::thread::available_parallelism().map_or(1, usize::from),
    };
    if let Err(failure) = validate(&mut cli, &environment) {
        terminal.stderr(&style.failure(&failure, &redactor));
        return ExitCode::FAILURE;
    }
    if let Some(Verb::Publish(publish)) = &cli.command {
        return entry_publish::run(publish, &style, redactor, terminal);
    }
    if let Some(Verb::Build(options)) = &cli.command {
        let cwd = match env::current_dir() {
            Ok(cwd) => cwd,
            Err(error) => {
                terminal.stderr(&style.error(
                    Code::ConfigInvalid,
                    &format!("working directory: {error}"),
                    &redactor,
                ));
                return ExitCode::FAILURE;
            }
        };
        let interrupts = match Interrupts::new() {
            Ok(value) => value,
            Err(error) => {
                terminal.stderr(&style.error(Code::BuildInvalid, &error.to_string(), &redactor));
                return ExitCode::FAILURE;
            }
        };
        let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
            inner: Arc::new(WorkingTree),
            cancellation: interrupts.cancellation.clone(),
        });
        let config =
            match (Loader { tree: tree.clone() }).load(&cwd, options.common.config.as_deref()) {
                Ok(config) => config,
                Err(source) => {
                    let failure = if interrupts.cancellation.requested() {
                        BuildError::Cancelled
                    } else {
                        BuildError::Catalogue { source }
                    };
                    terminal.stderr(&build_output::failure(&style, &failure, &redactor));
                    return ExitCode::FAILURE;
                }
            };
        let services = match Services::new(
            tree.clone(),
            &cwd,
            &config.repo_root,
            &options.common,
            redactor.clone(),
            interrupts.cancellation.clone(),
        ) {
            Ok(services) => services,
            Err(error) => {
                terminal.stderr(&style.error(Code::BuildInvalid, &error.to_string(), &redactor));
                return ExitCode::FAILURE;
            }
        };
        interrupts.attach(services.pool.clone());
        let service: &dyn BuildService = &CatalogueBuild {
            cancellation: interrupts.cancellation.clone(),
            graphs: services.runtime.clone(),
            config: Arc::new(LoadedConfig(config)),
            catalogue: Arc::new(Builder {
                tree: tree.clone(),
                discovery: Arc::new(Discoverer { tree }),
                definitions: services.runtime.clone(),
            }),
        };
        let result = service.run(&cwd, options);
        let shutdown = interrupts.shutdown();
        if let Err(error) = shutdown {
            terminal.stderr(&style.error(Code::BuildInvalid, &error.to_string(), &redactor));
            return ExitCode::FAILURE;
        }
        return match result {
            Ok(summary) => {
                terminal.stderr(&build_output::warnings(
                    &style,
                    &summary.warnings,
                    &redactor,
                ));
                terminal.stdout(&build_output::summary(&style, &summary));
                ExitCode::SUCCESS
            }
            Err(error) => {
                terminal.stderr(&build_output::failure(&style, &error, &redactor));
                ExitCode::FAILURE
            }
        };
    }
    let command = cli.command.as_ref().map_or("serve", Verb::name);
    let failure = Failure::Unavailable { command };
    terminal.stderr(&style.failure(&failure, &redactor));
    ExitCode::FAILURE
}

struct LoadedConfig(ResolvedConfig);
impl ConfigLoader for LoadedConfig {
    fn load(
        &self,
        _cwd: &std::path::Path,
        _explicit: Option<&str>,
    ) -> mokly_catalogue::error::Result<ResolvedConfig> {
        Ok(self.0.clone())
    }
}
