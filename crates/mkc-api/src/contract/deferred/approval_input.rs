//! Deferred approval input contract types.

use utoipa::ToSchema;
use uuid::Uuid;

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Approve {
    pub(crate) publication_id: Uuid,
    #[schema(pattern = "^[a-f0-9]{40}$")]
    pub(crate) expected_head_sha: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(nullable = false, max_length = 5000)]
    pub(crate) summary: Option<String>,
}
