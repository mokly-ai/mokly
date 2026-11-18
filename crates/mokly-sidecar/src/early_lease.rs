//! Exclusive process access for base preparation before current usage settles.

use crate::error::{Error, Result};
use crate::methods::Call;
use crate::pool_bundle_cache::BundleAttempt;
use crate::wire::MethodResult;

/// Request-local recovery retains its original failure and optional cache attempt.
pub struct EarlyRetry {
    /// The first runtime failure, preserved if its affine slot cannot recover.
    pub failure: Error,
    pub(crate) bundle: BundleAttempt,
}

impl EarlyRetry {
    /// Create recovery when no optional bundle-cache attempt preceded the failure.
    pub fn new(failure: Error) -> Self {
        Self {
            failure,
            bundle: BundleAttempt::default(),
        }
    }
}

/// A call either settled or must continue through ordinary admission after usage.
pub enum EarlyCall {
    /// The ordinary result, including its existing retry and deadline outcome.
    Complete(Result<MethodResult>),
    /// Maintenance ended the lease before this call began.
    Deferred,
    /// The first runtime attempt failed; only its one remaining retry may run.
    Retry(EarlyRetry),
}

/// One pool slot retained across the sidecar calls of early graph preparation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = EarlyLeaseMock))]
pub trait EarlyLease: Send + Sync {
    /// Run a call in the retained slot, with the ordinary deadlines and retry policy.
    fn request(&self, call: Call) -> EarlyCall;
    /// Stop and reap the slot's process, then return the confirmed empty slot.
    fn finish(&self) -> Result<()>;
}

#[cfg(test)]
#[path = "_tests_/early_lease_tests.rs"]
mod early_lease_tests;
