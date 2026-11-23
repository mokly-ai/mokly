//! Replayed preparation events use the same guarded output paths as serial Changes.

use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::Warning;
use mokly_compare::cache_types::Reporter;
use mokly_compare::comparison_steps::Steps;
use mokly_server::changes::{ChangeCancellation, ChangeProgress};
use mokly_server::error::Result;
use mokly_sidecar::workers::Diagnostics;

use crate::serve_eager_events::{PreparationEvent, PreparationSink};
use crate::serve_progress::TerminalEvent;
use crate::serve_warnings::AttemptWarnings;

pub(super) struct CurrentPreparation {
    pub(super) steps: Arc<dyn Steps>,
    pub(super) progress: Arc<dyn ChangeProgress>,
    pub(super) cache: Arc<dyn Reporter>,
    pub(super) warnings: Arc<Mutex<Vec<Warning>>>,
    pub(super) diagnostics: Arc<dyn Diagnostics>,
    pub(super) attempt: Arc<dyn AttemptWarnings>,
    pub(super) cancel: Arc<dyn ChangeCancellation>,
}

impl PreparationSink for CurrentPreparation {
    fn report(&self, event: &PreparationEvent) -> Result<bool> {
        if self.cancel.cancelled() {
            return Ok(false);
        }
        match event {
            PreparationEvent::Step(step) => self.steps.step(*step),
            PreparationEvent::Status(status) => return self.progress.status(*status),
            PreparationEvent::Cache(directory) => self.cache.opened(directory),
            PreparationEvent::Warnings(warnings) => self
                .warnings
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .extend_from_slice(warnings),
            PreparationEvent::Diagnostic(message) => {
                return Ok(self.cancel.commit(&TerminalEvent(&|| {
                    self.attempt.event(&|| self.diagnostics.emit(message))
                })));
            }
        }
        Ok(true)
    }
}
