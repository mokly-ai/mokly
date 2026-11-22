//! Optional evidence runs after terminal completion and the classification write lease.

use std::sync::Arc;

use tokio::sync::watch;

use crate::background::stopped;
use crate::changes::{ChangeCancellation, ChangeSource};
use crate::changes_background::ChangesPass;
use crate::error::{InternalError, ServerError};
use crate::snapshot::Snapshot;

impl ChangesPass {
    /// Check admission again on the blocking thread and drain all admitted seed work.
    pub(crate) async fn seed_after_completion(
        &self,
        origin: Arc<Snapshot>,
        source: Arc<dyn ChangeSource>,
        cancel: Arc<dyn ChangeCancellation>,
        stop: watch::Receiver<bool>,
    ) {
        if stopped(&stop) || cancel.cancelled() || !self.current(&origin) {
            return;
        }
        let owner = self.clone();
        let parent = tracing::Span::current();
        let task = tokio::task::spawn_blocking(move || {
            parent.in_scope(|| {
                if !stopped(&stop) && !cancel.cancelled() && owner.current(&origin) {
                    source.settled();
                }
            });
        });
        if let Err(source) = task.await {
            self.diagnostics
                .failed(&ServerError::Internal(InternalError::Task { source }));
        }
    }
}

#[cfg(test)]
#[path = "_tests_/changes_seed_admission_tests.rs"]
mod changes_seed_admission_tests;
#[cfg(test)]
#[path = "_tests_/changes_seed_tests.rs"]
mod changes_seed_tests;
