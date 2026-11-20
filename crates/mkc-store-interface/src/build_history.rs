//! One-statement history unions and build reads with retained reference context.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{BuildId, ProjectId};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::build::Build;
use crate::build_state::BuildState;
use crate::error::Result;
use crate::viewer::{HistoryFilter, PublicationPullRequest, ViewerPublication};

/// Reference's newest build in any state.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BuildSummary {
    /// Permanent build identifier.
    pub id: BuildId,
    /// Current build state.
    pub state: BuildState,
    /// Server scheduling time.
    pub created_at: DateTime<Utc>,
    /// Scheduled head object ID.
    pub head_sha: String,
}

/// Build plus its stored provider pull request context, if available.
#[derive(Clone, Debug)]
pub struct ViewerBuild {
    /// Durable build record.
    pub build: Build,
    /// Context for the scheduled repository and pull request number.
    pub pull_request: Option<PublicationPullRequest>,
}

/// Complete ordering key shared by both history entry kinds.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HistoryKey {
    /// Publication admission or build scheduling time.
    pub created_at: DateTime<Utc>,
    /// Unique UUID tie breaker across both kinds.
    pub id: Uuid,
}

/// Publication or unpublished build in the reference history union.
#[derive(Clone, Debug)]
pub enum HistoryEntry {
    /// Admitted publication, excluding unfinished and failed build uploads.
    Publication(ViewerPublication),
    /// Active or failed build without a committed publication.
    Build(ViewerBuild),
}

impl HistoryEntry {
    /// Stable key for continuation across both entry kinds.
    pub fn key(&self) -> HistoryKey {
        match self {
            Self::Publication(value) => HistoryKey {
                created_at: value.publication.created_at,
                id: value.publication.id.0,
            },
            Self::Build(value) => HistoryKey {
                created_at: value.build.created_at,
                id: value.build.id.0,
            },
        }
    }
}

/// Authorized history and contextual build reads.
#[unimock::unimock(api = BuildReadsMock)]
pub trait BuildReads {
    /// Page the union in one statement, newest time and UUID first.
    /// The caller supplies member access; publication exclusions apply to every reader.
    fn build_history(
        &mut self,
        project: ProjectId,
        filter: &HistoryFilter,
        after: Option<&HistoryKey>,
        limit: i64,
        include_builds: bool,
    ) -> Result<Vec<HistoryEntry>>;
    /// Read one project-scoped build and its retained pull request context.
    fn viewer_build(&mut self, project: ProjectId, build: BuildId) -> Result<Option<ViewerBuild>>;
}
