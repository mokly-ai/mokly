//! Build command entry with signals, a static transaction, and terminal completion.

use std::env;
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Instant;

use mokly_cli::build_output;
use mokly_cli::codes::Code;
use mokly_cli::grammar::Build;
use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;

use crate::interrupts::Interrupts;
use crate::one_shot::Lines;
use crate::static_runtime::{self, Context};
use crate::terminal::Terminal;
use crate::{command_diagnostics, serve_trace};

pub(super) fn run(
    options: &Build,
    style: &Style,
    redactor: Arc<Redactor>,
    terminal: Arc<dyn Terminal>,
) -> ExitCode {
    if options.common.debug_timings {
        serve_trace::install(terminal.clone(), format!("build-{}", std::process::id()));
    }
    let timing = tracing::info_span!("build", status = "error").entered();
    let started = Instant::now();
    let cwd = match env::current_dir() {
        Ok(cwd) => cwd,
        Err(error) => {
            terminal.stderr(&style.error(Code::ConfigInvalid, &error.to_string(), &redactor));
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
    let lines = Arc::new(Lines::new(
        style.clone(),
        redactor.clone(),
        terminal.clone(),
    ));
    let context = Context {
        cancellation: interrupts.cancellation.clone(),
        pool: interrupts.pool.clone(),
        phases: lines.clone(),
    };
    let result = static_runtime::run(&cwd, options, &context, None);
    lines.clear();
    match result {
        Ok((artifact, root)) => {
            timing.record("status", "ok");
            lines.built(&artifact, &root, started.elapsed());
            ExitCode::SUCCESS
        }
        Err(error) => {
            terminal.stderr(&build_output::failure(style, &error, &redactor));
            command_diagnostics::emit(&error, terminal.as_ref(), &redactor);
            ExitCode::FAILURE
        }
    }
}
