//! CLI-owned typed render and manual-rebuild diagnostics.

use std::io;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

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
use crate::terminal::Terminal;

pub(super) struct ServeLines {
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
    fn catalogue_failure(&self, error: &BuildError) {
        if self.cancellation.requested() {
            return;
        }
        self.terminal
            .stderr(&build_output::failure(&self.style, error, &self.redactor));
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
    fn server_failure(&self, error: &ServerError) {
        Diagnostics::failed(self, error);
    }
}
