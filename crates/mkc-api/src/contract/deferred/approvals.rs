//! Deferred approvals contract types.

use chrono::{DateTime, Utc};
use utoipa::ToSchema;
use uuid::Uuid;

use super::sync::Sync;

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Approval {
    pub(crate) id: Uuid,
    pub(crate) reviewer_id: Uuid,
    pub(crate) reviewer_name: String,
    pub(crate) publication_id: Uuid,
    #[schema(pattern = "^[a-f0-9]{40}$")]
    pub(crate) head_sha: String,
    pub(crate) created_at: DateTime<Utc>,
    #[schema(inline)]
    pub(crate) state: ApprovalState,
    pub(crate) summary: String,
    pub(crate) sync: Sync,
}

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Review {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    #[schema(minimum = 1)]
    pub(crate) pull_request_number: i64,
    #[schema(pattern = "^[a-f0-9]{40}$")]
    pub(crate) head_sha: String,
    pub(crate) publication_id: Uuid,
    #[schema(inline)]
    pub(crate) state: ReviewState,
    #[schema(inline)]
    pub(crate) approval_state: ReviewApprovalState,
    pub(crate) can_approve: bool,
    #[schema(inline)]
    pub(crate) cannot_approve_reason: ReviewCannotApproveReason,
    pub(crate) approvals: Vec<Approval>,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ApprovalState {
    Effective,
    Stale,
    Withdrawn,
    Unverified,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ReviewState {
    Open,
    Closed,
    Merged,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ReviewApprovalState {
    None,
    Required,
    Approved,
    Stale,
    Unverified,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ReviewCannotApproveReason {
    None,
    NoAccess,
    NotReady,
    Closed,
    OwnPullRequest,
}
