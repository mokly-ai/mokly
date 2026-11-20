//! Immutable inputs for one attempt, independent of scheduling and storage.

use std::fmt;

use chrono::{DateTime, Utc};
use mkc_domain::ids::ProjectId;
use uuid::Uuid;

use crate::input::{Branch, ConfigPath, HeadSha, Repository, UploadEndpoint};
use crate::secret::Secret;

/// Comparison policy supplied by the scheduler.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Comparison {
    /// Publish only the selected head.
    CurrentOnly,
    /// Compare against the fetched base branch.
    Base {
        /// Base branch name without the remote prefix.
        base_ref: Branch,
    },
}

/// All data required to run one build; credentials are never serialized.
#[derive(Clone)]
pub struct BuildRequest {
    /// Stable build UUID, used as the sandbox correlation ID.
    pub build_id: Uuid,
    /// Per-attempt operation UUID, also carried by every log chunk.
    pub attempt_operation_id: Uuid,
    /// Project that owns the sandbox and the upload exchange.
    pub project_id: ProjectId,
    /// Canonical repository identity.
    pub repository: Repository,
    /// Exact commit to fetch and check out.
    pub head_sha: HeadSha,
    /// Branch the published CLI reads from Git.
    pub branch: Branch,
    /// Current-only or base comparison mode.
    pub comparison: Comparison,
    /// Project configuration file within the repository.
    pub config_path: ConfigPath,
    /// Absolute UTC attempt deadline.
    pub deadline_at: DateTime<Utc>,
    /// Admission endpoint for the existing upload exchange.
    pub upload_endpoint: UploadEndpoint,
    /// Short-lived upload credential, added only to publish's environment.
    pub upload_token: Secret,
    /// Repository-scoped Contents-read credential, written only to Git's file.
    pub installation_token: Secret,
}

impl fmt::Debug for BuildRequest {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("BuildRequest")
            .field("build_id", &self.build_id)
            .field("attempt_operation_id", &self.attempt_operation_id)
            .field("project_id", &self.project_id)
            .field("deadline_at", &self.deadline_at)
            .field("upload_token", &self.upload_token)
            .field("installation_token", &self.installation_token)
            .finish_non_exhaustive()
    }
}
