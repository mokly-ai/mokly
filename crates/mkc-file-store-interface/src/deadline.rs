//! Shared bounded budget for one publication storage operation.

use std::time::Duration;

use chrono::{DateTime, Utc};

use crate::error::{Error, OperationDeadlineExceeded, Result};

/// Maximum time granted to one publication write or metadata existence check.
pub const MAX_OPERATION_DURATION: Duration = Duration::from_secs(60);

/// Budget shared by every provider interaction belonging to one storage operation.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OperationDeadline {
    timeout: Duration,
}

impl OperationDeadline {
    /// Build a budget from an explicit duration; zero represents an elapsed deadline.
    pub const fn new(timeout: Duration) -> Self {
        Self { timeout }
    }

    /// Derive the smaller of the remaining attempt time and the operation maximum.
    pub fn for_attempt(now: DateTime<Utc>, attempt_deadline: DateTime<Utc>) -> Option<Self> {
        let remaining = attempt_deadline.signed_duration_since(now).to_std().ok()?;
        (!remaining.is_zero()).then_some(Self {
            timeout: remaining.min(MAX_OPERATION_DURATION),
        })
    }

    /// Complete budget measured from the start of the operation.
    pub const fn timeout(self) -> Duration {
        self.timeout
    }

    /// Remaining budget after measured operation time, rejecting zero.
    pub fn remaining_after(self, elapsed: Duration) -> Result<Duration> {
        self.timeout
            .checked_sub(elapsed)
            .filter(|remaining| !remaining.is_zero())
            .ok_or_else(|| Error::internal(OperationDeadlineExceeded))
    }

    /// Reject a budget that was already exhausted before adapter work began.
    pub fn ensure_remaining(self) -> Result<()> {
        self.remaining_after(Duration::ZERO).map(|_| ())
    }
}

#[cfg(test)]
#[path = "_tests_/deadline_tests.rs"]
mod tests;
