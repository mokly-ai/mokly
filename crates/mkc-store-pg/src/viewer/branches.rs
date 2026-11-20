//! Branch union and default selection in a single project-scoped query.
//!
//! Names compare bytewise (`COLLATE "C"`), so the keyset predicate and the
//! `ORDER BY` agree under any database collation.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Bool, Nullable, Text, Timestamptz};
use mkc_domain::ids::ProjectId;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::viewer::{BranchKey, ViewerBranch};
use uuid::Uuid;

use crate::queries::PgQueries;

use super::{newest_build, newest_publication};

#[derive(QueryableByName)]
struct Row {
    #[diesel(sql_type = Text)]
    name: String,
    #[diesel(sql_type = Bool)]
    is_default: bool,
    #[diesel(sql_type = Timestamptz)]
    updated_at: DateTime<Utc>,
    #[diesel(sql_type = Nullable<diesel::sql_types::Uuid>)]
    latest_publication_id: Option<Uuid>,
    #[diesel(embed)]
    newest: newest_publication::Row,
    #[diesel(embed)]
    newest_build: newest_build::Row,
}

impl PgQueries<'_> {
    pub(super) fn branches(
        &mut self,
        project: ProjectId,
        after: Option<&BranchKey>,
        limit: i64,
    ) -> Result<Vec<ViewerBranch>> {
        let rows: Vec<Row> = diesel::sql_query(include_str!("branches.sql"))
            .bind::<diesel::sql_types::Uuid, _>(project.0)
            .bind::<Nullable<Bool>, _>(after.map(|key| key.is_default))
            .bind::<Nullable<Text>, _>(after.map(|key| &key.name))
            .bind::<BigInt, _>(limit.clamp(1, 101))
            .load(self.connection)
            .context("read viewer branch union")?;
        rows.into_iter()
            .map(|row| {
                Ok(ViewerBranch {
                    key: BranchKey {
                        name: row.name,
                        is_default: row.is_default,
                    },
                    latest_publication_id: row.latest_publication_id.map(Into::into),
                    newest_publication: row.newest.dto()?,
                    newest_build: row.newest_build.dto()?,
                    updated_at: row.updated_at,
                })
            })
            .collect()
    }
}
