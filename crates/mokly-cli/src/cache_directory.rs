//! Shared Serve directory announcement, independent of comparison-attempt lifetime.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_compare::cache_types::Reporter;

use crate::changes_runtime::cache_line;
use crate::terminal::Terminal;

pub(super) struct ServeDirectory {
    pub(super) announced: Arc<AtomicBool>,
    pub(super) terminal: Arc<dyn Terminal>,
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
}
impl Reporter for ServeDirectory {
    fn opened(&self, directory: &Path) {
        if !self.announced.swap(true, Ordering::AcqRel) {
            self.terminal
                .stdout(&cache_line(directory, &self.style, &self.redactor));
        }
    }
}
