//! Command cancellation is independent of whether a sidecar is active.

use std::sync::atomic::{AtomicUsize, Ordering};

/// Cancellation queried by build phases, source reads, and document workers.
pub trait Cancellation: Send + Sync {
    /// Whether the first interruption has requested cancellation.
    fn requested(&self) -> bool;
    /// Record an interruption; true means the caller must exit immediately.
    fn interrupt(&self) -> bool;
}

/// One cancellation state for one command.
#[derive(Default)]
pub struct BuildCancellation {
    signals: AtomicUsize,
}

impl Cancellation for BuildCancellation {
    fn requested(&self) -> bool {
        self.signals.load(Ordering::Acquire) != 0
    }
    fn interrupt(&self) -> bool {
        self.signals.fetch_add(1, Ordering::AcqRel) != 0
    }
}

#[cfg(test)]
#[path = "_tests_/cancellation_tests.rs"]
mod cancellation_tests;
