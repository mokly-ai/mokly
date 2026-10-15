//! Explicit command diagnostics retain error context and redact every stack line.

use std::backtrace::Backtrace;
use std::env;
use std::error::Error;

use mokly_cli::redaction::Redactor;
use mokly_cli::static_errors::without_prefixes;

use crate::terminal::Terminal;

pub(super) fn emit(error: &dyn Error, terminal: &dyn Terminal, redactor: &Redactor) {
    if env::var("MOKLY_DIAGNOSTIC").ok().as_deref() != Some("1") {
        return;
    }
    let stack = Backtrace::force_capture();
    let text = format!(
        "Diagnostic stack: {}\n{stack}",
        without_prefixes(&error.to_string())
    );
    for line in text.lines() {
        terminal.stderr(&format!("{}\n", redactor.safe(line)));
    }
}
