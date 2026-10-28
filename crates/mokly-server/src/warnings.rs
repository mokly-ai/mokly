//! Attempt-owned composition diagnostics, separate from HTTP and public models.

use mokly_catalogue::diagnostic::Warning;

/// Captured by a document backend before any of its renders start.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenderWarningsMock))]
pub trait RenderWarnings: Send + Sync {
    /// Deliver a render's retained warnings, also on failure. Saved and temporary renders
    /// deliver them before they return; the usage pass delivers a background render's
    /// warnings after it returns, in catalogue order.
    fn report(&self, warnings: &[Warning], failed: bool);
}

/// Library consumers can send composition warnings to their tracing subscriber.
pub struct TracingWarnings;

impl RenderWarnings for TracingWarnings {
    fn report(&self, warnings: &[Warning], _failed: bool) {
        for warning in warnings {
            tracing::warn!(
                code = warning.code,
                subject = warning.printed_subject(),
                message = warning.message
            );
        }
    }
}
