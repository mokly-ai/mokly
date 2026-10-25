//! Preserve source-adapter failures across authoring boundaries that emit diagnostics.

use std::sync::Arc;

use crate::error::Error;

/// Historical IO failure channel, independent of source validation diagnostics.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SourceFailuresMock))]
pub trait SourceFailures: Send + Sync {
    /// Recoverable checkout diagnostics for the current historical generation.
    fn warnings(&self) -> Vec<mokly_catalogue::diagnostic::Warning> {
        Vec::new()
    }
    /// First fatal source failure, or the first limit when no fatal failure occurred.
    fn failure(&self) -> Option<Arc<Error>>;
}
