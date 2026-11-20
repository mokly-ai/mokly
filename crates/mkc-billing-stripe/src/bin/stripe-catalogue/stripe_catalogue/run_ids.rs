//! Injectable per-invocation randomness for catalogue idempotency scope.

use mkc_billing_interface::catalogue_provider::RunId;
use mkc_billing_interface::error::Result;
use uuid::Uuid;

/// Source of fresh validated catalogue run identifiers.
#[cfg_attr(test, unimock::unimock(api = RunIdsMock))]
pub(crate) trait RunIds: Send + Sync {
    /// Generate one identifier for a complete command invocation.
    fn next(&self) -> Result<RunId>;
}

/// Operating-system randomness used by the command composition root.
pub(crate) struct OsRunIds;

impl RunIds for OsRunIds {
    fn next(&self) -> Result<RunId> {
        RunId::new(Uuid::new_v4().simple().to_string())
    }
}
