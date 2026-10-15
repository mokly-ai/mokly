//! CLI-owned typed render and manual-rebuild diagnostics.

use std::sync::Arc;

use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::build_output;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_cli::{serve_errors, serve_output};
use mokly_server::diagnostics::Diagnostics;
use mokly_server::error::ServerError;
use std::time::Duration;

use crate::serve_rebuild::RebuildReporter;
use crate::terminal::Terminal;

pub(super) struct ServeLines {
    pub(super) terminal: Arc<dyn Terminal>,
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
}
impl Diagnostics for ServeLines {
    fn failed(&self, error: &ServerError) {
        let output = serve_errors::failure(&self.style, error, &self.redactor);
        self.terminal.stderr(&output);
    }
}
impl RebuildReporter for ServeLines {
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
