//! Terminal build deletion with bounded candidates and ordered blob pre-locks.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Array, BigInt, Timestamptz, Uuid as SqlUuid};
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::blob_locks;
use crate::queries::PgQueries;

#[derive(QueryableByName)]
struct Candidate {
    #[diesel(sql_type = SqlUuid)]
    id: Uuid,
}

impl PgQueries<'_> {
    pub(super) fn prune(&mut self, before: DateTime<Utc>, limit: i64) -> Result<i64> {
        let candidates: Vec<Uuid> = diesel::sql_query(
            "SELECT id FROM builds
            WHERE finished_at <= $1 AND state NOT IN ('queued', 'running')
            ORDER BY finished_at, id LIMIT $2",
        )
        .bind::<Timestamptz, _>(before)
        .bind::<BigInt, _>(limit.clamp(1, 1000))
        .load::<Candidate>(self.connection)
        .context("select bounded retained build candidates before parent locks")?
        .into_iter()
        .map(|row| row.id)
        .collect();
        if candidates.is_empty() {
            return Ok(0);
        }
        diesel::sql_query(
            "SELECT p.id FROM projects p WHERE EXISTS
             (SELECT 1 FROM builds b WHERE b.project_id = p.id AND b.id = ANY($1))
             ORDER BY p.id FOR UPDATE OF p",
        )
        .bind::<Array<SqlUuid>, _>(&candidates)
        .load::<Candidate>(self.connection)
        .context("serialize retention and parent deletion before build locks")?;
        let ids: Vec<Uuid> = diesel::sql_query(
            "SELECT id FROM builds WHERE id = ANY($1) AND finished_at <= $2
             AND state NOT IN ('queued', 'running')
             ORDER BY finished_at, id FOR UPDATE SKIP LOCKED",
        )
        .bind::<Array<SqlUuid>, _>(&candidates)
        .bind::<Timestamptz, _>(before)
        .load::<Candidate>(self.connection)
        .context("lock retained candidates under their project locks")?
        .into_iter()
        .map(|row| row.id)
        .collect();
        if ids.is_empty() {
            return Ok(0);
        }
        for statement in [
            "SELECT id FROM builds WHERE superseded_by = ANY($1) ORDER BY id FOR UPDATE",
            "SELECT id FROM build_upload_grants WHERE build_id = ANY($1) ORDER BY id FOR UPDATE",
            "SELECT id FROM publications WHERE build_id = ANY($1) ORDER BY id FOR UPDATE",
        ] {
            diesel::sql_query(statement)
                .bind::<Array<SqlUuid>, _>(&ids)
                .load::<Candidate>(self.connection)
                .context("lock every build retention cascade row before blobs")?;
        }
        blob_locks::for_failed_build_uploads(self.connection, &ids)?;
        diesel::sql_query("DELETE FROM publications WHERE build_id = ANY($1) AND state = 'failed'")
            .bind::<Array<SqlUuid>, _>(&ids)
            .execute(self.connection)
            .context("delete failed publication attempts of retained builds")?;
        let count = diesel::sql_query("DELETE FROM builds WHERE id = ANY($1)")
            .bind::<Array<SqlUuid>, _>(&ids)
            .execute(self.connection)
            .context("delete retained builds and their children")?;
        i64::try_from(count).context("decode build retention count")
    }
}
