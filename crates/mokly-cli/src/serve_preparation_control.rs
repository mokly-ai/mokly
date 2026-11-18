//! Preparation handover contract shared by static and Serve composition.

use mokly_compare::base_render::PreparationCheckpoint;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::error::Result;

/// Current usage and its exact selection govern the one preparation handover.
#[cfg_attr(test, unimock::unimock(api = PreparationControlMock))]
pub(super) trait PreparationControl: Send + Sync {
    /// Record inputs before dependency selection, even when preparation later fails.
    fn selected(&self, sidecar: bool, directories: Vec<String>, unmapped: Vec<String>);
    /// Wait for completed usage or classification cancellation.
    fn wait(&self) -> Result<()>;
    /// Pause capture when needed and reject stale early selections.
    fn checkpoint(
        &self,
        request: &BaseRetentionRequest<'_>,
        checkpoint: PreparationCheckpoint,
    ) -> Result<bool>;
    /// Discard only the selection of the obsolete preparation.
    fn restarting(&self);
}
