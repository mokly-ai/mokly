//! Real environment and terminal composition for the mokly binary.

use std::env;
use std::io::{self, IsTerminal};
use std::process::ExitCode;
use std::sync::Arc;

use mokly_cli::grammar::Verb;
use mokly_cli::options::{Environment, validate};
use mokly_cli::output::{Style, select};
use mokly_cli::parsing::{ParseError, parse};
use mokly_cli::redaction::Redactor;
use mokly_cli::version::VERSION;
use mokly_publish::redaction::Secret;
use terminal_size::{Width, terminal_size};

use crate::terminal::{SystemTerminal, Terminal};
use crate::{entry_publish, entry_serve};

pub(super) fn main() -> ExitCode {
    let terminal: Arc<dyn Terminal> = Arc::new(SystemTerminal::default());
    let arguments: Vec<_> = env::args_os()
        .map(|value| value.to_string_lossy().into_owned())
        .collect();
    let token = env::var("MOKLY_TOKEN").ok().map(Secret::new);
    let redactor = Arc::new(Redactor::collect(
        &arguments,
        token.as_ref().map(Secret::expose),
    ));
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
    #[cfg(debug_assertions)]
    let style = Style {
        columns: crate::test_faults::columns(style.columns),
        ..style
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
        return crate::entry_build::run(options, &style, redactor, terminal);
    }
    let (common, options) = match &cli.command {
        Some(Verb::Serve(command)) => (&command.common, &command.options),
        _ => (&cli.common, &cli.serve),
    };
    entry_serve::run(common, options, &style, redactor, terminal)
}
