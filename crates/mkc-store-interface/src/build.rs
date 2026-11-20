//! Build records and query-only scheduling, lease and retention operations.

use chrono::{DateTime, Duration, Utc};
use mkc_domain::ids::{BuildId, ProjectId, PublicationId, RepositoryId};
use uuid::Uuid;

use crate::build_attempt::{BuildAttempt, BuildFinish};
use crate::build_clock::BuildClock;
use crate::build_state::{BuildFailure, BuildState, BuildStep, BuildTrigger};
use crate::error::Result;

/// A durable build, independent of sandbox provider identifiers.
#[derive(Clone, Debug)]
pub struct Build {
    /// Server-generated UUID v7.
    pub id: BuildId,
    /// Owning project.
    pub project_id: ProjectId,
    /// Bound repository at scheduling time.
    pub repository_id: RepositoryId,
    /// Scheduling cause.
    pub trigger: BuildTrigger,
    /// Exact head branch.
    pub branch: String,
    /// Lowercase SHA-1 or SHA-256 object ID.
    pub head_sha: String,
    /// Repository-local pull request, absent for a branch reference.
    pub pull_request: Option<i64>,
    /// Comparison branch; absent for current-only publication.
    pub base_ref: Option<String>,
    /// Project's config path at scheduling time.
    pub config_path: String,
    /// Current lifecycle state.
    pub state: BuildState,
    /// Current or failed step.
    pub step: Option<BuildStep>,
    /// Attempts started.
    pub attempt: i32,
    /// Earliest queued claim time.
    pub next_attempt_at: DateTime<Utc>,
    /// Last attempt's permanent operation identity, retained after it ends.
    pub attempt_operation_id: Option<Uuid>,
    /// Current running attempt's fence.
    pub lease_token: Option<Uuid>,
    /// Current running attempt's lease boundary.
    pub lease_expires_at: Option<DateTime<Utc>>,
    /// Last attempt's absolute budget boundary.
    pub deadline_at: Option<DateTime<Utc>>,
    /// Terminal failed or timed-out cause.
    pub failure_cause: Option<BuildFailure>,
    /// Consumer exit code, if known.
    pub exit_code: Option<i32>,
    /// Ready upload winner, including one created by another producer.
    pub publication_id: Option<PublicationId>,
    /// Build that replaced this reference's older head.
    pub superseded_by: Option<BuildId>,
    /// Bytes currently retained for the latest attempt.
    pub log_bytes: i64,
    /// Last sequence in the retained head, or zero.
    pub log_head_sequence: i64,
    /// Last allocated sequence; never reset across attempts.
    pub log_sequence: i64,
    /// Bytes removed from the latest attempt's rolling tail.
    pub log_elided_bytes: i64,
    /// The attempt's output is fully flushed.
    pub log_complete: bool,
    /// Server scheduling time.
    pub created_at: DateTime<Utc>,
    /// Latest attempt's start time.
    pub started_at: Option<DateTime<Utc>>,
    /// Terminal transition time.
    pub finished_at: Option<DateTime<Utc>>,
}

/// Immutable inputs for inserting a queued build.
#[derive(Clone, Debug)]
pub struct NewBuild {
    /// Pre-generated UUID v7.
    pub id: BuildId,
    /// Owning project.
    pub project_id: ProjectId,
    /// Validated bound repository.
    pub repository_id: RepositoryId,
    /// Scheduling cause; rerun never supersedes.
    pub trigger: BuildTrigger,
    /// Exact head branch.
    pub branch: String,
    /// Reconciled current object ID.
    pub head_sha: String,
    /// Pull request reference, or a branch when absent.
    pub pull_request: Option<i64>,
    /// Comparison branch, if any.
    pub base_ref: Option<String>,
    /// Authorized config path.
    pub config_path: String,
    /// Captured scheduling and first due time.
    pub created_at: DateTime<Utc>,
}

/// Query operations; services own eligibility and outcome policy.
#[unimock::unimock(api = BuildsMock)]
pub trait Builds {
    /// Read by ID for trusted outbox workers; HTTP callers must use the scoped read.
    fn build_by_id(&mut self, id: BuildId) -> Result<Option<Build>>;
    /// Read a build scoped to its project, in any state.
    fn build(&mut self, project: ProjectId, id: BuildId) -> Result<Option<Build>>;
    /// Read the active head used by scheduling policy.
    fn active_build(&mut self, project: ProjectId, head: &str) -> Result<Option<Build>>;
    /// Insert a queued row and supersede eligible older heads on its reference.
    /// The caller rechecks eligibility and ready/active duplicates in this transaction.
    /// Scheduling, starts, finalization, cancellation, log appends and pruning
    /// require Store::transaction; provider work must occur after commit.
    /// This query also bumps affected check rows.
    fn schedule_build(&mut self, value: &NewBuild) -> Result<()>;
    /// Lock the first due or lease-expired build and serialize its organization.
    /// The caller must start, recover or reject it before this transaction commits.
    /// A queued candidate requires fewer than two live organization leases.
    /// Recheck ownership with the clock guard after organization and build locks.
    fn claim_build(&mut self, clock: &dyn BuildClock) -> Result<Option<Build>>;
    /// Start a locked queued build, delete old chunks and bump its check.
    /// Rechecks the organization limit; preserves the permanent sequence counter.
    fn start_build(&mut self, id: BuildId, attempt: &BuildAttempt) -> Result<Option<Build>>;
    /// Lock the build, then renew only a lease strictly later than the clock guard.
    /// Extend from that fresh reading; false means the attempt lost ownership.
    fn renew_build(
        &mut self,
        id: BuildId,
        lease: Uuid,
        clock: &dyn BuildClock,
        duration: Duration,
    ) -> Result<bool>;
    /// Record progress and bump the check, fenced by the running lease.
    fn set_build_step(
        &mut self,
        id: BuildId,
        lease: Uuid,
        step: BuildStep,
        at: DateTime<Utc>,
    ) -> Result<bool>;
    /// Record a service-decided retry or terminal outcome and bump its check.
    /// Running rows require their lease; queued rejection requires no lease.
    fn finish_build(
        &mut self,
        id: BuildId,
        lease: Option<Uuid>,
        finish: &BuildFinish,
    ) -> Result<bool>;
    /// Cancel a queued or uncommitted running build; return terminal rows unchanged.
    fn cancel_build(
        &mut self,
        project: ProjectId,
        id: BuildId,
        at: DateTime<Utc>,
    ) -> Result<Option<Build>>;
    /// Delete at most 1,000 terminal rows at the cutoff, and their failed uploads.
    fn prune_builds(&mut self, before: DateTime<Utc>, limit: i64) -> Result<i64>;
    /// Resolve the running attempt for sandbox reconciliation; absence is safe to destroy.
    fn build_operation(&mut self, id: BuildId) -> Result<Option<Uuid>>;
}
