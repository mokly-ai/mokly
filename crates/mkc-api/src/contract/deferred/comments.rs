//! Deferred comments contract types.

use chrono::{DateTime, Utc};
use utoipa::ToSchema;
use uuid::Uuid;

use super::anchor::Anchor;
use super::sync::Sync;

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Comment {
    pub(crate) id: Uuid,
    #[schema(required)]
    pub(crate) author_id: Option<Uuid>,
    pub(crate) author_name: String,
    pub(crate) body: String,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
    pub(crate) deleted: bool,
    pub(crate) sync: Sync,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Thread {
    pub(crate) id: Uuid,
    pub(crate) anchor: Anchor,
    #[schema(inline)]
    pub(crate) state: ThreadState,
    #[schema(inline)]
    pub(crate) currency: ThreadCurrency,
    pub(crate) comments: Vec<Comment>,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
    pub(crate) can_resolve: bool,
    pub(crate) can_reply: bool,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ThreadState {
    Open,
    Resolved,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ThreadCurrency {
    Current,
    Outdated,
    Unverified,
}
