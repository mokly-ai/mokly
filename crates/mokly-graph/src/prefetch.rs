//! Classification-owned early work stops and joins when its guard leaves scope.

use std::sync::Arc;

/// Cancellation and joining boundary for one set of early base renders.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PrefetchMock))]
pub trait Prefetch: Send + Sync {
    /// Stop new early renders and wait for every admitted render to finish.
    fn cancel_and_join(&self);
}

/// A guard prevents early work from escaping preparation or capture.
pub struct PrefetchGuard {
    work: Arc<dyn Prefetch>,
}

impl PrefetchGuard {
    /// Attach one early-render lifetime to its owning classification.
    pub fn new(work: Arc<dyn Prefetch>) -> Self {
        Self { work }
    }
}

impl Drop for PrefetchGuard {
    fn drop(&mut self) {
        self.work.cancel_and_join();
    }
}
