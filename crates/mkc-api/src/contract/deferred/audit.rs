//! Deferred audit contract types.

use chrono::{DateTime, Utc};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AuditEvent {
    pub(crate) id: Uuid,
    #[schema(inline)]
    pub(crate) kind: AuditEventKind,
    pub(crate) actor: String,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) publication_id: Uuid,
    #[schema(required)]
    pub(crate) target_publication_id: Option<Uuid>,
    pub(crate) correlation_id: Uuid,
}

#[derive(ToSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum AuditEventKind {
    Submitted,
    Withdrawn,
    MadeStale,
    CarriedForward,
    AccessInvalidated,
    SyncQueued,
    SyncSucceeded,
    SyncFailed,
    PolicyChanged,
}
