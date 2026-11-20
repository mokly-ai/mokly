//! Check-run persistence contract shared with the publication worker.

use mkc_domain::ids::{ProjectId, RepositoryId};
use uuid::Uuid;

use crate::error::Result;

/// Check identity and durable rerequest intent; the publication worker owns output.
#[derive(Clone, Debug)]
pub struct CheckRun {
    /// Cloud check identity.
    pub id: Uuid,
    /// Owning project.
    pub project_id: ProjectId,
    /// Installed repository receiving the check.
    pub repository_id: RepositoryId,
    /// GitHub check-run ID.
    pub github_id: i64,
    /// Checked commit.
    pub head_sha: String,
    /// Stable provider reconciliation key.
    pub external_id: String,
    /// A verified check event requested another run.
    pub rerequested: bool,
}

/// Check queries used by webhook handling and the publication worker.
#[unimock::unimock(api = GitHubChecksMock)]
pub trait GitHubChecks {
    /// Record an acknowledged provider identity without clearing rerequest intent.
    fn record_github_check(&mut self, value: &CheckRun) -> Result<()>;
    /// Insert or update a known check.
    fn save_github_check(&mut self, value: &CheckRun) -> Result<()>;
    /// Read a provider check ID.
    fn github_check(&mut self, github_id: i64) -> Result<Option<CheckRun>>;
    /// Read a project's stable provider reconciliation key.
    fn github_check_by_external_id(
        &mut self,
        project: ProjectId,
        external_id: &str,
    ) -> Result<Option<CheckRun>>;
    /// Lock at most one hundred marked rows in the caller's outbox transaction.
    /// The prefix selects the check owner, such as `mokly-publication:`.
    /// Lock all candidate organizations, then projects, in UUID order before checks.
    /// Skip busy parents and checks; recheck marks after locking and keep all locks
    /// through the effect write and mark clear in this transaction.
    fn rerequested_github_checks(&mut self, prefix: &str, limit: i64) -> Result<Vec<CheckRun>>;
    /// Clear the locked mark in the same transaction as its outbox write.
    fn clear_github_check_rerequest(&mut self, id: Uuid) -> Result<()>;
    /// List checks belonging to one installed repository.
    fn github_checks(&mut self, repository: RepositoryId) -> Result<Vec<CheckRun>>;
}
