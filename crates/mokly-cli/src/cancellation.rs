//! Command cancellation combines forwarded signal copies before forcing exit.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use mokly_sidecar::workers::Clock;

/// A scope that lets an output transaction settle before forced process exit.
pub trait OutputProtection: Send + Sync {}
impl OutputProtection for () {}

/// Cancellation queried by build phases, source reads, and document workers.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CancellationMock))]
pub trait Cancellation: Send + Sync {
    /// Whether the first interruption has requested cancellation.
    fn requested(&self) -> bool;
    /// Observe all signal notifications already delivered before a phase settles.
    fn drain(&self) {}
    /// Record an interruption; true means the caller must exit immediately.
    fn interrupt(&self) -> bool;
    /// Protect output writes, unless a forced exit has already been requested.
    fn protect_output(&self) -> Option<Box<dyn OutputProtection>> {
        Some(Box::new(()))
    }
    /// Wait for a deferred forced exit, or return false when none is pending.
    fn wait_for_forced_exit(&self) -> bool {
        false
    }
}

/// One cancellation state for one command.
pub struct BuildCancellation {
    requested: AtomicBool,
    force: Arc<ForceState>,
    clock: Arc<dyn Clock>,
}

impl BuildCancellation {
    /// Combine signal copies within one second of the first signal.
    pub fn new(clock: Arc<dyn Clock>) -> Self {
        Self {
            requested: AtomicBool::new(false),
            force: Arc::new(ForceState::default()),
            clock,
        }
    }
}

impl Cancellation for BuildCancellation {
    fn requested(&self) -> bool {
        self.requested.load(Ordering::Acquire)
    }
    fn interrupt(&self) -> bool {
        let mut state = self
            .force
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let now = self.clock.now_ms();
        if let Some(first) = state.first_signal {
            if now.saturating_sub(first) < 1_000 {
                return false;
            }
            state.pending = true;
            return state.protected == 0;
        }
        state.first_signal = Some(now);
        self.requested.store(true, Ordering::Release);
        false
    }

    fn protect_output(&self) -> Option<Box<dyn OutputProtection>> {
        let mut state = self
            .force
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state.pending {
            return None;
        }
        state.protected += 1;
        Some(Box::new(ProtectedOutput(self.force.clone())))
    }

    fn wait_for_forced_exit(&self) -> bool {
        let mut state = self
            .force
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !state.pending {
            return false;
        }
        while state.protected != 0 {
            state = self
                .force
                .settled
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
        true
    }
}

#[derive(Default)]
struct ForceState {
    state: Mutex<Force>,
    settled: Condvar,
}

#[derive(Default)]
struct Force {
    first_signal: Option<u64>,
    protected: usize,
    pending: bool,
}

struct ProtectedOutput(Arc<ForceState>);
impl OutputProtection for ProtectedOutput {}

impl Drop for ProtectedOutput {
    fn drop(&mut self) {
        let mut state = self
            .0
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.protected -= 1;
        self.0.settled.notify_all();
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
