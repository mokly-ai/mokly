//! Typed public viewer responses, independent of provider and database rows.

use chrono::{DateTime, Utc};
use mkc_domain::entry_path::EntryPath;
use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use mkc_mokly_contract::index_values::{ColorScheme, Viewport};
use serde::Serialize;
use utoipa::ToSchema;

use crate::builds::views::BuildSummary;

use super::publication_state::{PublicationFailureView, PublicationStateView};

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Branch {
    pub(crate) name: String,
    #[schema(required, value_type = Option<Uuid>)]
    pub(crate) latest_publication_id: Option<PublicationId>,
    /// Newest admitted attempt in any lifecycle state, or null without publication
    /// history.
    #[schema(required)]
    pub(crate) newest_publication: Option<PublicationSummary>,
    /// Newest build in any state; null for readers without member access.
    #[schema(required)]
    pub(crate) newest_build: Option<BuildSummary>,
    #[schema(format = DateTime)]
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PullRequest {
    #[schema(minimum = 1)]
    pub(crate) number: i64,
    pub(crate) title: String,
    /// Provider login; null for observations predating author retention.
    #[schema(required)]
    pub(crate) author: Option<String>,
    pub(crate) branch: String,
    /// True when the stored head or base GitHub repository ID differs from the project's bound repository ID, including a missing head or base repository. Independent of reader role, plan, build availability and pull request state.
    pub(crate) fork: bool,
    #[schema(inline)]
    pub(crate) state: PullState,
    #[schema(format = "uri")]
    pub(crate) url: String,
    #[schema(required, value_type = Option<Uuid>)]
    pub(crate) latest_publication_id: Option<PublicationId>,
    /// Newest admitted attempt in any lifecycle state, or null without publication
    /// history.
    #[schema(required)]
    pub(crate) newest_publication: Option<PublicationSummary>,
    /// Newest build in any state; null for readers without member access.
    #[schema(required)]
    pub(crate) newest_build: Option<BuildSummary>,
}

/// Project-visible newest attempt; all authorized readers receive the same fields.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PublicationSummary {
    #[schema(inline, format = Uuid)]
    pub(crate) id: PublicationId,
    /// Cloud build that created this publication; null when no retained build association exists.
    #[schema(required, value_type = Option<Uuid>)]
    pub(crate) build_id: Option<BuildId>,
    #[schema(inline)]
    pub(crate) state: PublicationStateView,
    /// Server admission time.
    #[schema(format = DateTime)]
    pub(crate) published_at: DateTime<Utc>,
    #[schema(required, pattern = "^([a-f0-9]{40}|[a-f0-9]{64})$")]
    pub(crate) head_sha: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(crate) enum PullState {
    Open,
    Closed,
    Merged,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Screen {
    /// Current entry path. Listing omits paths that fail the server's share selection
    /// checks.
    pub(crate) path: EntryPath,
    pub(crate) title: String,
    pub(crate) views: Vec<ScreenView>,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ScreenView {
    #[schema(inline)]
    pub(crate) viewport: Viewport,
    #[schema(inline)]
    pub(crate) color_scheme: ColorScheme,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Changes {
    #[schema(inline)]
    pub(crate) state: ChangesState,
    #[schema(required, minimum = 0)]
    pub(crate) added: Option<u64>,
    #[schema(required, minimum = 0)]
    pub(crate) changed: Option<u64>,
    #[schema(required, minimum = 0)]
    pub(crate) removed: Option<u64>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum ChangesState {
    Available,
    NoComparison,
    Unavailable,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Publication {
    #[schema(inline, format = Uuid)]
    pub(crate) id: PublicationId,
    #[schema(inline, format = Uuid)]
    pub(crate) project_id: ProjectId,
    /// Cloud build that created this publication; null when no retained build association exists.
    #[schema(required, value_type = Option<Uuid>)]
    pub(crate) build_id: Option<BuildId>,
    #[schema(required)]
    pub(crate) branch: Option<String>,
    #[schema(required, pattern = "^([a-f0-9]{40}|[a-f0-9]{64})$")]
    pub(crate) head_sha: Option<String>,
    #[schema(format = DateTime)]
    pub(crate) published_at: DateTime<Utc>,
    #[schema(inline)]
    pub(crate) state: PublicationStateView,
    /// Persisted upload failure classification; null unless the attempt failed.
    #[schema(required, inline)]
    pub(crate) failure_code: Option<PublicationFailureView>,
    #[schema(required, format = "uri")]
    pub(crate) catalogue_url: Option<String>,
    #[schema(required, format = Uuid)]
    pub(crate) review_id: Option<String>,
    pub(crate) changes: Changes,
    pub(crate) can_comment: bool,
    /// Observed PR matching the admitted PR number and bound repository; null without
    /// either identity or observation.
    #[schema(required)]
    pub(crate) pull_request: Option<PublicationPullRequest>,
}

/// Stored originating PR observation, governed by the enclosing project visibility.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PublicationPullRequest {
    #[schema(minimum = 1)]
    pub(crate) number: i64,
    pub(crate) title: String,
    /// Provider login; null for observations predating author retention.
    #[schema(required)]
    pub(crate) author: Option<String>,
    #[schema(format = "uri")]
    pub(crate) url: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ShareLink {
    #[schema(format = "uri")]
    pub(crate) url: String,
    #[schema(inline)]
    pub(crate) access: ShareAccess,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ShareAccess {
    Public,
    Members,
}
