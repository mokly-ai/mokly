//! Real environment and terminal composition for the mokly binary.

use std::env;
use std::io::{self, IsTerminal, Write};
use std::process::ExitCode;

use clap::Parser;
use clap::error::{ContextKind, ErrorKind};
use mokly_cli::errors::{Code, Failure};
use mokly_cli::grammar::{Cli, Verb};
use mokly_cli::options::{Environment, validate};
use mokly_cli::output::{Style, select};
use mokly_cli::redaction::Redactor;
use terminal_size::{Width, terminal_size};

trait Terminal {
    fn stdout(&self, text: &str);
    fn stderr(&self, text: &str);
}

struct SystemTerminal;

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
    let redactor = Redactor::collect(&arguments, token.as_deref());
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
    let mut cli = match Cli::try_parse_from(&arguments) {
        Ok(cli) => cli,
        Err(error)
            if matches!(
                error.kind(),
                ErrorKind::DisplayHelp | ErrorKind::DisplayVersion
            ) =>
        {
            terminal.stdout(&error.to_string());
            return ExitCode::SUCCESS;
        }
        Err(error) => {
            let message = if error.kind() == ErrorKind::InvalidSubcommand {
                error.get(ContextKind::InvalidSubcommand).map_or_else(
                    || first_line(&error),
                    |candidate| format!("unknown command: {candidate}"),
                )
            } else if arguments.iter().any(|argument| argument == "--strict")
                && !arguments
                    .iter()
                    .any(|argument| matches!(argument.as_str(), "build" | "publish"))
            {
                "--strict belongs to build or publish".to_owned()
            } else if error.kind() == ErrorKind::UnknownArgument {
                error.get(ContextKind::InvalidArg).map_or_else(
                    || first_line(&error),
                    |option| format!("unknown option: {option}"),
                )
            } else {
                first_line(&error)
            };
            terminal.stderr(&style.error(Code::CliInvalid, &message, &redactor));
            return ExitCode::FAILURE;
        }
    };
    let environment = Environment {
        sidecars: env::var("MOKLY_SIDECARS").ok(),
        endpoint: env::var("MOKLY_ENDPOINT").ok(),
        token,
        cores: std::thread::available_parallelism().map_or(1, usize::from),
    };
    if let Err(failure) = validate(&mut cli, &environment) {
        let Failure::Invalid { message } = failure else {
            return ExitCode::FAILURE;
        };
        terminal.stderr(&style.error(Code::CliInvalid, &message, &redactor));
        return ExitCode::FAILURE;
    }
    let command = cli.command.as_ref().map_or("serve", Verb::name);
    let failure = Failure::Unavailable { command };
    terminal.stderr(&format!("{}\n", redactor.safe(&failure.to_string())));
    ExitCode::FAILURE
}

fn first_line(error: &clap::Error) -> String {
    error
        .to_string()
        .lines()
        .next()
        .unwrap_or("invalid command")
        .trim_start_matches("error: ")
        .to_owned()
}
