//! Real environment and terminal composition for the mokly binary.

use std::env;
use std::io::{self, IsTerminal, Write};
use std::process::ExitCode;
use std::sync::Arc;

use mokly_catalogue::config::Loader;
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::Builder;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::{BuildService, CatalogueBuild};
use mokly_cli::codes::Code;
use mokly_cli::errors::Failure;
use mokly_cli::grammar::Verb;
use mokly_cli::options::{Environment, validate};
use mokly_cli::output::{Style, select};
use mokly_cli::parsing::{ParseError, parse};
use mokly_cli::redaction::Redactor;
use mokly_cli::version::VERSION;
use mokly_cli::{build_output, changes_output};
use mokly_graph::cache::{MemoryCache, RenderCache};
use mokly_source_interface::tree::SourceTree;
use terminal_size::{Width, terminal_size};

use crate::{changes_runtime, entry_publish};

use super::render_runtime::NativeGraphs;

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
        let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
        let cache: Arc<dyn RenderCache> = Arc::new(MemoryCache::new(256 * 1024 * 1024));
        let service: &dyn BuildService = &CatalogueBuild {
            changes: changes_runtime::service(cache.clone()),
            graphs: Arc::new(NativeGraphs {
                tree: tree.clone(),
                cache,
            }),
            config: Arc::new(Loader { tree: tree.clone() }),
            catalogue: Arc::new(Builder {
                tree: tree.clone(),
                discovery: Arc::new(Discoverer { tree }),
                definitions: Arc::new(DeferredDefinitions),
            }),
        };
        return match service.run(&cwd, options) {
            Ok(summary) => {
                terminal.stderr(&build_output::warnings(
                    &style,
                    &summary.warnings,
                    &redactor,
                ));
                terminal.stderr(&changes_output::diagnostics(
                    &style,
                    &summary.changes,
                    &redactor,
                ));
                terminal.stdout(&build_output::summary(&style, &summary, &redactor));
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
