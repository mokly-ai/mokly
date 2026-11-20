//! Scoped activity and late-bound publication readiness for optional writes.

/// Current publication state, queried without holding the writer controller.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = WriteReadinessMock))]
pub trait WriteReadiness: Send + Sync {
    /// Only a committed ready or unavailable Changes result permits new work.
    fn ready(&self) -> bool;
}

/// Local work suppresses optional persistence until its lease ends.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = WriteActivityMock))]
pub trait WriteActivity: Send + Sync {
    /// Enter before queued work and retain the lease through detached blocking work.
    fn enter(&self) -> Box<dyn WriteLease>;
}

/// Dropping the last local owner wakes optional writer admission.
pub trait WriteLease: Send + Sync {}
