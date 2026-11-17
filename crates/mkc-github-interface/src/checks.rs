//! Check-run integration consumed by the publication/check worker.

use serde::{Deserialize, Serialize};

use crate::error::Result;

/// Lifecycle statuses accepted for a GitHub App's check run.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    /// Waiting to run.
    Queued,
    /// Work has started.
    InProgress,
    /// Work has a final conclusion.
    Completed,
}

/// Final check outcomes supported by GitHub.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Conclusion {
    /// Successful validation.
    Success,
    /// Validation failed.
    Failure,
    /// Informational outcome without approval semantics.
    Neutral,
    /// Cancelled work.
    Cancelled,
    /// Execution deadline reached.
    TimedOut,
    /// A user action is required.
    ActionRequired,
    /// Superseded work.
    Stale,
    /// Work intentionally skipped.
    Skipped,
}

/// Markdown check content supplied by the publication worker.
#[derive(Clone, Debug, Serialize)]
pub struct Output {
    /// Short user-facing result title.
    pub title: String,
    /// Main Markdown summary.
    pub summary: String,
    /// Optional secondary Markdown details.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

/// Initial check payload; external ID allows caller-managed reconciliation.
#[derive(Clone, Debug, Serialize)]
pub struct Create {
    /// Check name, normally Mokly.
    pub name: String,
    /// Full commit SHA.
    pub head_sha: String,
    /// Immutable publication URL on the app origin.
    pub details_url: String,
    /// Stable cloud identifier for this check.
    pub external_id: String,
    /// Initial lifecycle and optional conclusion/output.
    #[serde(flatten)]
    pub update: Update,
}

/// Check lifecycle update supplied by the worker.
#[derive(Clone, Debug, Serialize)]
pub struct Update {
    /// Optional replacement app destination, including renamed or expired publications.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details_url: Option<String>,
    /// Current status.
    pub status: Status,
    /// Present exactly when status is completed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conclusion: Option<Conclusion>,
    /// Optional replacement output.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<Output>,
}

/// Provider check identity returned by creation/update.
#[derive(Clone, Debug, Deserialize)]
pub struct CheckRun {
    /// Stable GitHub check ID.
    pub id: i64,
    /// Commit associated with this check.
    pub head_sha: String,
    /// Caller-supplied recovery key when present.
    pub external_id: Option<String>,
    /// Current lifecycle.
    pub status: Status,
    /// Final conclusion when completed.
    pub conclusion: Option<Conclusion>,
}

/// App check-run behavior, independent of publication persistence.
#[unimock::unimock(api = ChecksMock)]
pub trait Checks: Send + Sync {
    /// List all Mokly runs on a head for this App, including earlier runs.
    fn list(
        &self,
        installation: i64,
        repository: &str,
        head_sha: &str,
        app_id: i64,
    ) -> Result<Vec<CheckRun>>;
    /// Create a check; callers reconcile ambiguous transport failures.
    fn create(&self, installation: i64, repository: &str, input: &Create) -> Result<CheckRun>;
    /// Update one known check.
    fn update(
        &self,
        installation: i64,
        repository: &str,
        id: i64,
        input: &Update,
    ) -> Result<CheckRun>;
    /// Ask GitHub to redeliver the check rerequest event.
    fn rerequest(&self, installation: i64, repository: &str, id: i64) -> Result<()>;
}
