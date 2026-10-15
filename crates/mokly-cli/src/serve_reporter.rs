//! CLI-owned typed render and manual-rebuild diagnostics.

use std::sync::Arc;

use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::build_output;
use mokly_cli::codes::Code;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_server::diagnostics::Diagnostics;
use mokly_server::error::ServerError;

use crate::entry::{SystemTerminal, Terminal};
use crate::serve_rebuild::RebuildReporter;

pub(super) struct ServeLines {
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
}
impl Diagnostics for ServeLines {
    fn failed(&self, error: &ServerError) {
        let output = match error {
            ServerError::Render { source } => {
                build_output::render_diagnostics(&self.style, source, &self.redactor)
            }
            _ => self
                .style
                .error(Code::BuildInvalid, &error.to_string(), &self.redactor),
        };
        SystemTerminal.stderr(&output);
    }
}
impl RebuildReporter for ServeLines {
    fn completed(&self, summary: &BuildSummary) {
        SystemTerminal.stderr(&build_output::warnings(
            &self.style,
            &summary.warnings,
            &self.redactor,
        ));
        SystemTerminal.stdout(&build_output::summary(&self.style, summary));
    }
    fn catalogue_failure(&self, error: &BuildError) {
        SystemTerminal.stderr(&build_output::failure(&self.style, error, &self.redactor));
        if self.style.mode == Mode::Rich {
            SystemTerminal.stderr(&format!(
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
