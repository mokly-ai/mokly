//! GitHub installation, repository and branch read contracts.

use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::error::Result;

/// Type of account that owns an App installation.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
pub enum AccountKind {
    /// A personal GitHub account.
    User,
    /// A GitHub organization.
    Organization,
    /// An enterprise account; callers may reject unsupported installation ownership.
    Enterprise,
    /// GitHub's automated actor, never an installation owner.
    Bot,
}

/// Stable provider account identity.
#[derive(Clone, Debug, Deserialize)]
pub struct Account {
    /// Stable GitHub integer ID.
    pub id: i64,
    /// Current display/login name.
    pub login: String,
    /// Account category.
    #[serde(rename = "type")]
    pub kind: AccountKind,
}

/// Installation state fetched using App authentication.
#[derive(Clone, Debug, Deserialize)]
pub struct Installation {
    /// Stable GitHub installation ID.
    pub id: i64,
    /// Registered App's integer ID.
    pub app_id: i64,
    /// Account administering the installation.
    pub account: Account,
    /// GitHub installation settings URL.
    pub html_url: String,
    /// Suspension timestamp; absent means usable.
    pub suspended_at: Option<DateTime<Utc>>,
}

/// Repository metadata returned by the installed-repositories API.
#[derive(Clone, Debug, Deserialize)]
pub struct Repository {
    /// Stable GitHub repository ID.
    pub id: i64,
    /// Canonical owner/name pair.
    pub full_name: String,
    /// Default branch name, including any embedded slashes.
    pub default_branch: String,
    /// Whether GitHub considers the repository private.
    pub private: bool,
}

/// Latest commit of a branch.
#[derive(Clone, Debug, Deserialize)]
pub struct Branch {
    /// Branch name.
    pub name: String,
    /// Current head commit.
    pub commit: Commit,
}

/// Commit identity at a provider boundary.
#[derive(Clone, Debug, Deserialize)]
pub struct Commit {
    /// Full Git commit object ID.
    pub sha: String,
}

/// App and installation reads used by onboarding and webhook reconciliation.
#[unimock::unimock(api = RepositoriesMock)]
pub trait Repositories: Send + Sync {
    /// Fetch current installation state with an App JWT.
    fn installation(&self, installation: i64) -> Result<Installation>;
    /// Fetch all repositories currently available to an installation.
    fn repositories(&self, installation: i64) -> Result<Vec<Repository>>;
    /// Fetch a branch by name; a deleted branch is `NotFound`.
    fn branch(&self, installation: i64, repository: &str, branch: &str) -> Result<Branch>;
}
