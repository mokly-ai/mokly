//! Monotonic measurement of one shared provider-operation budget.

use std::sync::Arc;
use std::time::{Duration, Instant};

use mkc_file_store_interface::deadline::OperationDeadline;
use mkc_file_store_interface::error::Result;

/// Monotonic time seam for deterministic provider-budget tests.
#[unimock::unimock(api = ClockMock)]
pub trait Clock: Send + Sync {
    /// Current monotonic instant.
    fn now(&self) -> Instant;
}

/// Operating-system monotonic clock.
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> Instant {
        Instant::now()
    }
}

pub(crate) struct RequestBudget {
    deadline: OperationDeadline,
    started_at: Instant,
    clock: Arc<dyn Clock>,
}

impl RequestBudget {
    pub(crate) fn new(deadline: OperationDeadline, clock: Arc<dyn Clock>) -> Result<Self> {
        deadline.ensure_remaining()?;
        let started_at = clock.now();
        Ok(Self {
            deadline,
            started_at,
            clock,
        })
    }

    pub(crate) fn remaining(&self) -> Result<Duration> {
        self.deadline
            .remaining_after(self.clock.now().saturating_duration_since(self.started_at))
    }
}
