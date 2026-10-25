//! Publication-local live work validity, independent of a reusable graph backend.

use std::sync::atomic::{AtomicBool, Ordering};

/// Live jobs retain this fence from their admitted publication.
#[cfg_attr(test, unimock::unimock(api = RenderLeaseMock))]
pub trait RenderLease: Send + Sync {
    /// A superseded publication admits no queued render work.
    fn valid(&self) -> bool;
    /// Invalidate the publication before its replacement event is sent.
    fn expire(&self);
}

/// Process-memory validity flag with no disk or clock dependency.
pub struct RevisionLease {
    expired: AtomicBool,
}
impl Default for RevisionLease {
    fn default() -> Self {
        Self {
            expired: AtomicBool::new(false),
        }
    }
}
impl RenderLease for RevisionLease {
    fn valid(&self) -> bool {
        !self.expired.load(Ordering::SeqCst)
    }
    fn expire(&self) {
        self.expired.store(true, Ordering::SeqCst);
    }
}
