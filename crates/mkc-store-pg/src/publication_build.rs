//! Query-only cleanup of unfinished publications belonging to an ending build attempt.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Array, Text, Timestamptz, Uuid as SqlUuid};
use mkc_domain::ids::BuildId;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::publication::PublicationFailure;
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(QueryableByName)]
struct Closed {
    #[diesel(sql_type = SqlUuid)]
    id: Uuid,
}

impl PgQueries<'_> {
    pub(crate) fn close_build_uploads(
        &mut self,
        build: BuildId,
        since: DateTime<Utc>,
        failure: PublicationFailure,
        at: DateTime<Utc>,
    ) -> Result<i64> {
        self.close_build_upload_batch(&[(build, since)], failure, at)
    }

    pub(crate) fn close_build_upload_batch(
        &mut self,
        attempts: &[(BuildId, DateTime<Utc>)],
        failure: PublicationFailure,
        at: DateTime<Utc>,
    ) -> Result<i64> {
        let builds: Vec<_> = attempts.iter().map(|(build, _)| build.0).collect();
        let starts: Vec<_> = attempts.iter().map(|(_, since)| *since).collect();
        let ids: Vec<Uuid> = diesel::sql_query(
            "SELECT p.id FROM publications p
             JOIN unnest($1::uuid[], $2::timestamptz[]) a(build_id, started_at)
               ON p.build_id = a.build_id AND p.created_at >= a.started_at
             WHERE p.state IN ('uploading', 'validating') ORDER BY p.id FOR UPDATE OF p",
        )
        .bind::<Array<SqlUuid>, _>(&builds)
        .bind::<Array<Timestamptz>, _>(&starts)
        .load::<Closed>(self.connection)
        .context("lock all ending build publications before blobs")?
        .into_iter()
        .map(|row| row.id)
        .collect();
        if ids.is_empty() {
            return Ok(0);
        }
        diesel::sql_query(
            "UPDATE publications SET state = 'failed', failure_code = $2 WHERE id = ANY($1)",
        )
        .bind::<Array<SqlUuid>, _>(&ids)
        .bind::<Text, _>(failure.as_str())
        .execute(self.connection)
        .context("close ending build uploads")?;
        diesel::sql_query(
            "SELECT b.incarnation AS id FROM blobs b
             WHERE EXISTS (SELECT 1 FROM publication_files f
                 WHERE f.publication_id = ANY($1) AND f.project_id = b.project_id AND f.blob_hash = b.hash)
             ORDER BY b.project_id, b.hash COLLATE \"C\" FOR UPDATE OF b",
        )
        .bind::<Array<SqlUuid>, _>(&ids)
        .load::<Closed>(self.connection)
        .context("lock ending upload blobs in canonical order")?;
        diesel::sql_query("DELETE FROM publication_files WHERE publication_id = ANY($1)")
            .bind::<Array<SqlUuid>, _>(&ids)
            .execute(self.connection)
            .context("release ending build upload references")?;
        diesel::sql_query(
            "INSERT INTO publication_events (id, publication_id, kind, created_at, next_attempt_at)
             SELECT build_failure_event_id, id, 'failed', $2, $2 FROM publications WHERE id = ANY($1)",
        )
        .bind::<Array<SqlUuid>, _>(&ids)
        .bind::<Timestamptz, _>(at)
        .execute(self.connection)
        .context("record ending build upload failures")?;
        i64::try_from(ids.len()).context("count closed build uploads")
    }
}
