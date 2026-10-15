//! Command cancellation combines forwarded signal copies before forcing exit.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_sidecar::workers::Clock;

/// Cancellation queried by build phases, source reads, and document workers.
pub trait Cancellation: Send + Sync {
    /// Whether the first interruption has requested cancellation.
    fn requested(&self) -> bool;
    /// Record an interruption; true means the caller must exit immediately.
    fn interrupt(&self) -> bool;
}

/// One cancellation state for one command.
pub struct BuildCancellation {
    requested: AtomicBool,
    first_signal: Mutex<Option<u64>>,
    clock: Arc<dyn Clock>,
}

impl BuildCancellation {
    /// Combine signal copies within one second of the first signal.
    pub fn new(clock: Arc<dyn Clock>) -> Self {
        Self {
            requested: AtomicBool::new(false),
            first_signal: Mutex::new(None),
            clock,
        }
    }
}

impl Cancellation for BuildCancellation {
    fn requested(&self) -> bool {
        self.requested.load(Ordering::Acquire)
    }
    fn interrupt(&self) -> bool {
        let mut first = self
            .first_signal
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let now = self.clock.now_ms();
        if let Some(first) = *first {
            return now.saturating_sub(first) >= 1_000;
        }
        *first = Some(now);
        self.requested.store(true, Ordering::Release);
        false
    }
}

#[cfg(test)]
#[path = "_tests_/cancellation_tests.rs"]
mod cancellation_tests;

/// Serve stop state never requests a forced process exit.
#[derive(Default)]
pub struct ServeCancellation {
    requested: AtomicBool,
}

impl Cancellation for ServeCancellation {
    fn requested(&self) -> bool {
        self.requested.load(Ordering::Acquire)
    }
    fn interrupt(&self) -> bool {
        self.requested.store(true, Ordering::Release);
        false
    }
}
