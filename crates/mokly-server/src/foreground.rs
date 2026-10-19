//! Request leases let shared runtime admission yield to whole foreground renders.

/// The command's shared resource scheduler observes queued and active HTTP work.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ForegroundMock))]
pub trait Foreground: Send + Sync {
    /// Hold priority until the complete request finishes or is cancelled.
    fn enter(&self) -> Box<dyn ForegroundLease>;
}

/// Dropping the request lease admits waiting background work again.
pub trait ForegroundLease: Send + Sync {}
