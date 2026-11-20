//! Nullable newest-build columns for both reference lists.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Nullable, Text, Timestamptz, Uuid as SqlUuid};
use mkc_store_interface::build_history::BuildSummary;
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use uuid::Uuid;

use crate::publication_row::InvalidRecord;

#[derive(QueryableByName)]
pub(super) struct Row {
    #[diesel(sql_type = Nullable<SqlUuid>)]
    newest_build_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<Text>)]
    newest_build_state: Option<String>,
    #[diesel(sql_type = Nullable<Timestamptz>)]
    newest_build_created_at: Option<DateTime<Utc>>,
    #[diesel(sql_type = Nullable<Text>)]
    newest_build_head_sha: Option<String>,
}

impl Row {
    pub(super) fn dto(self) -> Result<Option<BuildSummary>> {
        match (
            self.newest_build_id,
            self.newest_build_state,
            self.newest_build_created_at,
            self.newest_build_head_sha,
        ) {
            (Some(id), Some(state), Some(created_at), Some(head_sha)) => Ok(Some(BuildSummary {
                id: id.into(),
                state: state.parse().context("decode newest build state")?,
                created_at,
                head_sha,
            })),
            (None, None, None, None) => Ok(None),
            _ => Err(Error::internal(InvalidRecord)),
        }
    }
}
