//! Caller-decided attempt and finalization inputs; the store does no retry policy.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::build_state::{BuildFailure, BuildState};

/// Stable attempt identities with fresh times read under the claim locks.
#[derive(Clone, Debug)]
pub struct BuildAttempt {
    /// Start time sampled after the claim locks on this transaction attempt.
    pub now: DateTime<Utc>,
    /// Fresh operation ID used by logs and reconciliation.
    pub operation_id: Uuid,
    /// Fresh running-write fence.
    pub lease_token: Uuid,
    /// Lease expiry, normally two minutes after start.
    pub lease_expires_at: DateTime<Utc>,
    /// Absolute deadline set by the worker when the attempt starts.
    pub deadline_at: DateTime<Utc>,
}

/// Retry or terminal state selected by the service.
#[derive(Clone, Debug)]
pub struct BuildFinish {
    /// Queued retry or a terminal outcome.
    pub state: BuildState,
    /// Cause required for failed and timed-out outcomes.
    pub failure_cause: Option<BuildFailure>,
    /// Consumer exit code, if any.
    pub exit_code: Option<i32>,
    /// Captured transition time.
    pub at: DateTime<Utc>,
    /// Retry due time, or the transition time for a terminal outcome.
    pub next_attempt_at: DateTime<Utc>,
}
