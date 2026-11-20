//! Current repository branch and pull request read models.

use chrono::{DateTime, Utc};
use mkc_domain::ids::RepositoryId;

use crate::error::Result;

/// Current PR metadata reconciled from GitHub, scoped to one installed repository.
#[derive(Clone, Debug)]
pub struct PullRequest {
    /// Owning installed repository.
    pub repository_id: RepositoryId,
    /// Repository-local pull request number.
    pub number: i64,
    /// GitHub title.
    pub title: String,
    /// Provider author login, absent on observations predating author retention.
    pub author: Option<String>,
    /// Whether the PR is open.
    pub open: bool,
    /// Whether the PR was merged.
    pub merged: bool,
    /// Source branch.
    pub head_ref: String,
    /// Source commit.
    pub head_sha: String,
    /// Destination branch.
    pub base_ref: String,
    /// Destination commit.
    pub base_sha: String,
    /// Last observed head repository; absent for deleted or older observations.
    pub head_repository_id: Option<i64>,
    /// Last observed base repository; absent before repository identity retention.
    pub base_repository_id: Option<i64>,
    /// Reconciliation observation time.
    pub updated_at: DateTime<Utc>,
}

/// Current branch tip, retaining deletion observations.
#[derive(Clone, Debug)]
pub struct Branch {
    /// Owning installed repository.
    pub repository_id: RepositoryId,
    /// Branch name including slashes.
    pub name: String,
    /// Current commit, or absent for a deleted branch.
    pub head_sha: Option<String>,
    /// Reconciliation observation time.
    pub updated_at: DateTime<Utc>,
}

/// Persisted branch and PR queries for later publication association.
#[unimock::unimock(api = GitHubRefsMock)]
pub trait GitHubRefs {
    /// Save current PR state.
    fn save_github_pull_request(&mut self, value: &PullRequest) -> Result<()>;
    /// List a repository's known PRs.
    fn github_pull_requests(&mut self, repository: RepositoryId) -> Result<Vec<PullRequest>>;
    /// Save current branch or deletion state.
    fn save_github_branch(&mut self, value: &Branch) -> Result<()>;
    /// List a repository's known branches, including deletions.
    fn github_branches(&mut self, repository: RepositoryId) -> Result<Vec<Branch>>;
}
