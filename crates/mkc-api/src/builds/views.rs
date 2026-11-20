//! Build resource and log responses omit credentials and worker fences.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use serde::Serialize;
use utoipa::ToSchema;

use crate::viewer::views::PublicationPullRequest;

use super::state::{BuildFailureView, BuildStateView, BuildStreamView, BuildTriggerView};
use super::step::BuildStepView;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Build {
    #[schema(inline, format = Uuid)]
    pub(crate) id: BuildId,
    #[schema(inline, format = Uuid)]
    pub(crate) project_id: ProjectId,
    pub(crate) state: BuildStateView,
    #[schema(inline)]
    pub(crate) trigger: BuildTriggerView,
    pub(crate) branch: String,
    #[schema(pattern = "^([a-f0-9]{40}|[a-f0-9]{64})$")]
    pub(crate) head_sha: String,
    #[schema(required)]
    pub(crate) pull_request: Option<PublicationPullRequest>,
    #[schema(required)]
    pub(crate) base_ref: Option<String>,
    pub(crate) step: BuildStepView,
    #[schema(format = DateTime)]
    pub(crate) created_at: DateTime<Utc>,
    #[schema(required, format = DateTime)]
    pub(crate) started_at: Option<DateTime<Utc>>,
    #[schema(required, format = DateTime)]
    pub(crate) finished_at: Option<DateTime<Utc>>,
    #[schema(minimum = 0)]
    pub(crate) attempt: i32,
    #[schema(required)]
    pub(crate) failure: Option<Failure>,
    #[schema(required, value_type = Option<Uuid>)]
    pub(crate) publication_id: Option<PublicationId>,
    #[schema(required, value_type = Option<Uuid>)]
    pub(crate) superseded_by: Option<BuildId>,
    /// True only for an authorized caller and a queued or running build whose upload has not committed.
    pub(crate) can_cancel: bool,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = BuildFailure)]
pub(crate) struct Failure {
    pub(crate) step: BuildStepView,
    #[schema(inline)]
    pub(crate) cause: BuildFailureView,
    #[schema(required)]
    pub(crate) exit_code: Option<i32>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct BuildSummary {
    #[schema(inline, format = Uuid)]
    pub(crate) id: BuildId,
    pub(crate) state: BuildStateView,
    #[schema(format = DateTime)]
    pub(crate) created_at: DateTime<Utc>,
    #[schema(pattern = "^([a-f0-9]{40}|[a-f0-9]{64})$")]
    pub(crate) head_sha: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = BuildLog)]
pub(crate) struct Log {
    #[schema(max_items = 100)]
    pub(crate) chunks: Vec<LogChunk>,
    #[schema(minimum = 0)]
    pub(crate) next_after: i64,
    pub(crate) complete: bool,
    #[schema(required)]
    pub(crate) elision: Option<Elision>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = BuildLogChunk)]
pub(crate) struct LogChunk {
    #[schema(minimum = 1)]
    pub(crate) sequence: i64,
    #[schema(minimum = 1)]
    pub(crate) attempt: i32,
    pub(crate) step: BuildStepView,
    #[schema(inline)]
    pub(crate) stream: BuildStreamView,
    /// UTF-8 with replacement, terminal controls removed, and line endings normalized.
    pub(crate) text: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = BuildLogElision)]
pub(crate) struct Elision {
    #[schema(minimum = 0)]
    pub(crate) after_sequence: i64,
    #[schema(minimum = 1)]
    pub(crate) bytes: i64,
}
