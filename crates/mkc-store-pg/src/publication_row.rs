//! Private Diesel row mapping for immutable publication metadata.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::publication::publications;
use mkc_store_interface::error::{Error, Result};
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationMetadata, PublicationState,
};
use uuid::Uuid;

use crate::publication_changes_row::ChangesRow;

#[derive(Queryable, QueryableByName, Selectable, Insertable)]
#[diesel(table_name = publications)]
pub(crate) struct PublicationRow {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) build_id: Option<Uuid>,
    pub(crate) build_failure_event_id: Option<Uuid>,
    pub(crate) branch: Option<String>,
    pub(crate) head_sha: Option<String>,
    pub(crate) base_ref: Option<String>,
    pub(crate) base_sha: Option<String>,
    pub(crate) pull_request: Option<i64>,
    pub(crate) config_path: Option<String>,
    pub(crate) exported_at: Option<DateTime<Utc>>,
    pub(crate) comparison_path: Option<String>,
    pub(crate) state: String,
    pub(crate) failure_code: Option<String>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) deadline: DateTime<Utc>,
    pub(crate) expired_at: Option<DateTime<Utc>>,
    pub(crate) changes_state: Option<String>,
    pub(crate) changes_added: Option<i64>,
    pub(crate) changes_changed: Option<i64>,
    pub(crate) changes_removed: Option<i64>,
}

#[derive(Debug, thiserror::Error)]
#[error("[mkc-store-pg/publication_row] inconsistent stored publication")]
pub(crate) struct InvalidRecord;

impl PublicationRow {
    pub(crate) fn dto(self) -> Result<Publication> {
        let metadata = match (
            self.branch,
            self.head_sha,
            self.config_path,
            self.exported_at,
        ) {
            (Some(branch), Some(head_sha), Some(config_path), Some(exported_at)) => {
                Some(PublicationMetadata {
                    branch,
                    head_sha,
                    config_path,
                    exported_at,
                    base_ref: self.base_ref,
                    base_sha: self.base_sha,
                    pull_request: self.pull_request,
                })
            }
            (None, None, None, None) => None,
            _ => return Err(Error::internal(InvalidRecord)),
        };
        let state = publication_state(&self.state)?;
        let failure = match self.failure_code.as_deref() {
            None => None,
            Some("invalid-bundle") => Some(PublicationFailure::InvalidBundle),
            Some("unsupported-version") => Some(PublicationFailure::UnsupportedVersion),
            Some("too-large") => Some(PublicationFailure::TooLarge),
            Some("unauthorized") => Some(PublicationFailure::Unauthorized),
            Some("internal") => Some(PublicationFailure::Internal),
            Some("expired") => Some(PublicationFailure::Expired),
            Some("superseded") => Some(PublicationFailure::Superseded),
            _ => return Err(Error::internal(InvalidRecord)),
        };
        Ok(Publication {
            id: self.id.into(),
            project_id: self.project_id.into(),
            build_id: self.build_id.map(Into::into),
            build_failure_event_id: self.build_failure_event_id,
            metadata,
            state,
            failure,
            created_at: self.created_at,
            deadline: self.deadline,
            expired_at: self.expired_at,
            changes: ChangesRow {
                changes_state: self.changes_state,
                changes_added: self.changes_added,
                changes_changed: self.changes_changed,
                changes_removed: self.changes_removed,
            }
            .dto()?,
        })
    }

    pub(crate) fn record(value: &Publication) -> Result<Self> {
        let metadata = value.metadata.as_ref();
        let changes = ChangesRow::record(value.changes)?;
        Ok(Self {
            id: value.id.0,
            project_id: value.project_id.0,
            build_id: value.build_id.map(|id| id.0),
            build_failure_event_id: value.build_failure_event_id,
            branch: metadata.map(|m| m.branch.clone()),
            head_sha: metadata.map(|m| m.head_sha.clone()),
            base_ref: metadata.and_then(|m| m.base_ref.clone()),
            base_sha: metadata.and_then(|m| m.base_sha.clone()),
            pull_request: metadata.and_then(|m| m.pull_request),
            config_path: metadata.map(|m| m.config_path.clone()),
            exported_at: metadata.map(|m| m.exported_at),
            comparison_path: None,
            state: value.state.as_str().to_owned(),
            failure_code: value.failure.map(|f| f.as_str().to_owned()),
            created_at: value.created_at,
            deadline: value.deadline,
            expired_at: value.expired_at,
            changes_state: changes.changes_state,
            changes_added: changes.changes_added,
            changes_changed: changes.changes_changed,
            changes_removed: changes.changes_removed,
        })
    }
}

/// Decode the shared database state representation for full rows and summaries.
pub(crate) fn publication_state(value: &str) -> Result<PublicationState> {
    Ok(match value {
        "uploading" => PublicationState::Uploading,
        "validating" => PublicationState::Validating,
        "ready" => PublicationState::Ready,
        "expired" => PublicationState::Expired,
        "failed" => PublicationState::Failed,
        _ => return Err(Error::internal(InvalidRecord)),
    })
}
