//! Nullable newest-attempt columns shared by both reference list queries.
//!
//! Each list fills them in its one statement through a `LEFT JOIN LATERAL ...
//! LIMIT 1` probe per reference over the all-state indexes ordered by project,
//! reference, admission time and ID, so no per-row query follows the page.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Nullable, Text, Timestamptz};
use mkc_store_interface::error::{Error, Result};
use mkc_store_interface::viewer::PublicationSummary;
use uuid::Uuid;

use crate::publication_row::{InvalidRecord, publication_state};

#[derive(QueryableByName)]
pub(super) struct Row {
    #[diesel(sql_type = Nullable<diesel::sql_types::Uuid>)]
    newest_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<Text>)]
    newest_state: Option<String>,
    #[diesel(sql_type = Nullable<Timestamptz>)]
    newest_created_at: Option<DateTime<Utc>>,
    #[diesel(sql_type = Nullable<Text>)]
    newest_head_sha: Option<String>,
    #[diesel(sql_type = Nullable<diesel::sql_types::Uuid>)]
    newest_build_origin_id: Option<Uuid>,
}

impl Row {
    pub(super) fn dto(self) -> Result<Option<PublicationSummary>> {
        match (self.newest_id, self.newest_state, self.newest_created_at) {
            (Some(id), Some(state), Some(created_at)) => Ok(Some(PublicationSummary {
                id: id.into(),
                build_id: self.newest_build_origin_id.map(Into::into),
                state: publication_state(&state)?,
                created_at,
                head_sha: self.newest_head_sha,
            })),
            (None, None, None) if self.newest_head_sha.is_none() => Ok(None),
            _ => Err(Error::internal(InvalidRecord)),
        }
    }
}
