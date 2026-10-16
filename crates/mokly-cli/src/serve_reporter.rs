//! CLI-owned typed render and manual-rebuild diagnostics.

use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_catalogue::diagnostic::Warning;
use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::build_output;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_cli::{serve_errors, serve_output, watch_output};
use mokly_server::diagnostics::Diagnostics;
use mokly_server::error::ServerError;
use mokly_watch::event::Batch;

use crate::serve_rebuild::RebuildReporter;
use crate::serve_warnings::AttemptWarnings;
use crate::terminal::Terminal;

pub(super) struct ServeLines {
    pub(super) cwd: PathBuf,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) terminal: Arc<dyn Terminal>,
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
}
impl Diagnostics for ServeLines {
    fn accept_failed(&self, error: &io::Error) {
        self.terminal.stderr(&serve_output::accept_failure(
            &self.style,
            &error.to_string(),
            &self.redactor,
        ));
    }
    fn accept_recovered(&self) {
        self.terminal
            .stderr(&serve_output::accept_recovery(&self.style));
    }
    fn failed(&self, error: &ServerError) {
        if self.cancellation.requested() {
            return;
        }
        let output = serve_errors::failure(&self.style, error, &self.redactor);
        self.terminal.stderr(&output);
    }
}
impl RebuildReporter for ServeLines {
    fn watcher_rescan(&self) {
        let text = "Watch notifications were lost. Rescanning catalogue inputs.";
        self.terminal.stderr(&if self.style.mode == Mode::Plain {
            format!("[mokly/warning] {text}\n")
        } else {
            format!("{}\n", bounded(&format!("  ! {text}"), self.style.columns))
        });
    }

    fn watched_catalogue_failure(
        &self,
        batch: &Batch,
        repository: &Path,
        warnings: &[Warning],
        error: &BuildError,
    ) {
        if self.cancellation.requested() {
            return;
        }
        let warnings = build_output::warnings(&self.style, warnings, &self.redactor);
        let plain = Style {
            mode: Mode::Plain,
            color: false,
            ..self.style.clone()
        };
        let diagnostics = if self.style.mode == Mode::Plain {
            build_output::failure_diagnostics(&plain, error, &self.redactor)
        } else {
            mokly_cli::watch_diagnostics::diagnostics(&plain, error, &self.redactor)
        };
        self.failure_line(batch, repository, &warnings, &diagnostics);
    }
    fn watched_server_failure(
        &self,
        batch: &Batch,
        repository: &Path,
        warnings: &[Warning],
        error: &ServerError,
    ) {
        if self.cancellation.requested() {
            return;
        }
        let plain = Style {
            mode: Mode::Plain,
            color: false,
            ..self.style.clone()
        };
        let diagnostics = serve_errors::failure(&plain, error, &self.redactor);
        let warnings = build_output::warnings(&self.style, warnings, &self.redactor);
        self.failure_line(batch, repository, &warnings, &diagnostics);
    }
    fn watched(
        &self,
        batch: &Batch,
        repository: &Path,
        summary: Option<&BuildSummary>,
        elapsed: Duration,
    ) {
        if self.cancellation.requested() {
            return;
        }
        if let Some(summary) = summary {
            self.terminal.stderr(&build_output::warnings(
                &self.style,
                &summary.warnings,
                &self.redactor,
            ));
        }
        let time = chrono::Local::now().format("%H:%M:%S").to_string();
        let line = watch_output::line(
            &self.style,
            batch,
            repository,
            &time,
            elapsed,
            summary.is_some(),
            &self.redactor,
        );
        if summary.is_some() {
            self.terminal.stdout(&line);
        } else {
            self.terminal.stderr(&line);
        }
    }
    fn completed(&self, summary: &BuildSummary, elapsed: Duration) {
        self.terminal.stderr(&build_output::warnings(
            &self.style,
            &summary.warnings,
            &self.redactor,
        ));
        self.terminal
            .stdout(&serve_output::catalogue(&self.style, summary, elapsed));
    }
    fn catalogue_failure(&self, warnings: &[Warning], error: &BuildError) {
        if self.cancellation.requested() {
            return;
        }
        self.terminal.stderr(
            &(build_output::warnings(&self.style, warnings, &self.redactor)
                + &build_output::failure_diagnostics(&self.style, error, &self.redactor)
                + &mokly_cli::recovery_output::build(error, &self.cwd, &self.redactor)),
        );
        if self.style.mode == Mode::Rich {
            self.terminal.stderr(&format!(
                "{}\n",
                bounded(
                    "  The last good catalogue is still being served.",
                    self.style.columns
                )
            ));
        }
    }
    fn server_failure(&self, warnings: &[Warning], error: &ServerError) {
        if self.cancellation.requested() {
            return;
        }
        self.terminal.stderr(&build_output::warnings(
            &self.style,
            warnings,
            &self.redactor,
        ));
        Diagnostics::failed(self, error);
    }
}

impl ServeLines {
    pub(super) fn preparation_failed(&self, attempt: &dyn AttemptWarnings, error: &BuildError) {
        attempt.finish(&build_output::warning_records(error), true, &|warnings| {
            self.terminal.stderr(
                &(build_output::warnings(&self.style, warnings, &self.redactor)
                    + &build_output::failure_diagnostics(&self.style, error, &self.redactor)),
            );
        });
    }
    fn failure_line(&self, batch: &Batch, repository: &Path, warnings: &str, diagnostics: &str) {
        let time = chrono::Local::now().format("%H:%M:%S").to_string();
        self.terminal.stderr(&watch_output::failure(
            &self.style,
            batch,
            repository,
            &time,
            warnings,
            diagnostics,
            &self.redactor,
        ));
    }
}

#[cfg(test)]
#[path = "_tests_/serve_reporter_tests.rs"]
mod serve_reporter_tests;
