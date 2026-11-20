//! Deferred sync contract types.

use utoipa::ToSchema;

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Sync {
    #[schema(inline)]
    pub(crate) state: SyncState,
    #[schema(inline)]
    pub(crate) identity: SyncIdentity,
    #[schema(required, format = "uri")]
    pub(crate) url: Option<String>,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SyncState {
    NotApplicable,
    Queued,
    Synced,
    Failed,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SyncIdentity {
    User,
    App,
    None,
}
