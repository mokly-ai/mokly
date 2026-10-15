//! Watch event formatting keeps authored paths bounded and plain output silent.

use std::path::Path;
use std::time::Duration;

use mokly_catalogue::config::relative;
use mokly_watch::event::{Action, Batch};

use crate::output::{Mode, Style, bounded};
use crate::redaction::Redactor;
use crate::serve_output::{columns, duration};

/// One settled watch event with an injected clock label for deterministic tests.
pub fn line(
    style: &Style,
    batch: &Batch,
    repository: &Path,
    time: &str,
    elapsed: Duration,
    success: bool,
    redactor: &Redactor,
) -> String {
    if style.mode == Mode::Plain {
        return String::new();
    }
    let mut paths: Vec<_> = batch
        .events
        .keys()
        .take(3)
        .map(|path| redactor.safe(&relative(path, repository)))
        .collect();
    if paths.is_empty() {
        paths.push("manual rebuild".into());
    }
    if batch.events.len() > 3 {
        paths.push(format!("+{} more", batch.events.len() - 3));
    }
    let (unicode, ascii, word) = match batch.action.unwrap_or(Action::Rebuild) {
        Action::Reload => ("⟳", "L", "reloaded"),
        Action::Rebuild => ("↻", "R", "rebuilt"),
        Action::Config => ("↺", "C", "config reloaded"),
    };
    let glyph = if !success {
        if style.ascii { "x" } else { "✖" }
    } else if style.ascii {
        ascii
    } else {
        unicode
    };
    let label = format!("  {time}  {glyph} {}", paths.join(", "));
    let text = if success {
        columns(
            &format!("{label}  {word}"),
            &duration(elapsed),
            style.columns,
        )
    } else {
        bounded(&label, style.columns)
    };
    format!("{text}\n")
}

#[cfg(test)]
#[path = "_tests_/watch_output_tests.rs"]
mod watch_output_tests;
