//! Deferred comment input contract types.

use utoipa::ToSchema;

use super::anchor::Anchor;
use super::comments::ThreadState;

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateThread {
    pub(crate) anchor: Anchor,
    #[schema(min_length = 1, max_length = 5000)]
    pub(crate) body: String,
}

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Reply {
    #[schema(min_length = 1, max_length = 5000)]
    pub(crate) body: String,
}

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UpdateComment {
    #[schema(min_length = 1, max_length = 5000)]
    pub(crate) body: String,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
    /// Required when an administrator moderates another author’s comment.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(nullable = false, min_length = 1, max_length = 500)]
    pub(crate) moderation_reason: Option<String>,
}

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ResolveThread {
    #[schema(inline)]
    pub(crate) state: ThreadState,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DeleteComment {
    #[schema(minimum = 1)]
    pub(crate) version: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(nullable = false, min_length = 1, max_length = 500)]
    pub(crate) moderation_reason: Option<String>,
}
