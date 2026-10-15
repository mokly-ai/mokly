//! Preserve source-adapter failures across authoring boundaries that emit diagnostics.

use std::sync::Arc;

use crate::error::Error;

/// Historical IO failure channel, independent of source validation diagnostics.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SourceFailuresMock))]
pub trait SourceFailures: Send + Sync {
    /// First typed failure observed by this immutable adapter.
    fn failure(&self) -> Option<Arc<Error>>;
}
