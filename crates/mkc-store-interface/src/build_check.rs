//! Versioned build check outbox and per-row delivery claims.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{BuildId, ProjectId};

use crate::error::Result;

/// One due outbox row; reading it grants no ownership.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BuildCheck {
    /// Build whose current result will be delivered.
    pub build_id: BuildId,
    /// Latest state version, advanced by each bump.
    pub version: i64,
    /// Last successfully acknowledged state version.
    pub delivered_version: i64,
    /// Retry fence, advanced by each claim or operator requeue.
    pub attempts: i32,
    /// Permanent failure budget since the last bump or requeue.
    pub permanent_failures: i32,
    /// Retry due time.
    pub next_attempt_at: DateTime<Utc>,
    /// Permanent budget was exhausted at this time.
    pub dead_lettered_at: Option<DateTime<Utc>>,
    /// Delivery claim deadline, independent of state bumps and retry due times.
    pub claim_expires_at: Option<DateTime<Utc>>,
}

/// Query-only build check delivery operations.
#[unimock::unimock(api = BuildChecksMock)]
pub trait BuildChecks {
    /// Insert or bump a build's check; never end an active delivery claim.
    fn bump_build_check(&mut self, build: BuildId, at: DateTime<Utc>) -> Result<()>;
    /// Due undelivered rows without a live claim, optionally scoped before the limit.
    fn pending_build_checks(
        &mut self,
        at: DateTime<Utc>,
        limit: i64,
        project: Option<ProjectId>,
    ) -> Result<Vec<BuildCheck>>;
    /// Claim one observed retry version for exactly five minutes.
    /// Call just before provider work in its own transaction.
    fn claim_build_check(
        &mut self,
        build: BuildId,
        attempts: i32,
        at: DateTime<Utc>,
    ) -> Result<Option<BuildCheck>>;
    /// Acknowledge only the state version the claim read and release its claim.
    fn deliver_build_check(&mut self, build: BuildId, attempts: i32, version: i64) -> Result<bool>;
    /// Record a fenced failure and backoff, releasing its claim.
    /// Permanent failures increment the current budget atomically, including after a bump.
    fn retry_build_check(
        &mut self,
        build: BuildId,
        attempts: i32,
        permanent: bool,
        next: DateTime<Utc>,
        at: DateTime<Utc>,
    ) -> Result<bool>;
    /// Reset a dead letter's permanent budget, make it due and fence stale writes.
    fn requeue_build_check(&mut self, build: BuildId, at: DateTime<Utc>) -> Result<bool>;
    /// Count only undelivered dead letters.
    fn build_check_dead_letter_count(&mut self) -> Result<i64>;
}
