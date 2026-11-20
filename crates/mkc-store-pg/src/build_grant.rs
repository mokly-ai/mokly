//! Build-scoped capability digests, consumption and ranked upload answers.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Text, Timestamptz, Uuid as SqlUuid};
use mkc_db::schema::build_output::build_upload_grants;
use mkc_domain::ids::{BuildId, PublicationId};
use mkc_store_interface::build_clock::BuildClock;
use mkc_store_interface::build_grant::{BuildUploadGrant, BuildUploadGrants};
use mkc_store_interface::build_state::UploadOutcome;
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(Queryable, Selectable)]
#[diesel(table_name = build_upload_grants)]
struct Row {
    id: Uuid,
    build_id: Uuid,
    attempt: i32,
    token_digest: Vec<u8>,
    expires_at: DateTime<Utc>,
    consumed_at: Option<DateTime<Utc>>,
    outcome: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, thiserror::Error)]
#[error("[mkc-store-pg/build_grant] stored digest is not 32 bytes")]
struct InvalidDigest;

impl Row {
    fn dto(self) -> Result<BuildUploadGrant> {
        let Ok(token_digest) = self.token_digest.try_into() else {
            return Err(Error::internal(InvalidDigest));
        };
        Ok(BuildUploadGrant {
            id: self.id,
            build_id: self.build_id.into(),
            attempt: self.attempt,
            token_digest,
            expires_at: self.expires_at,
            consumed_at: self.consumed_at,
            outcome: self
                .outcome
                .map(|v| v.parse().context("decode build upload outcome"))
                .transpose()?,
            created_at: self.created_at,
        })
    }
}

impl BuildUploadGrants for PgQueries<'_> {
    fn mint_build_grant(&mut self, value: &BuildUploadGrant) -> Result<bool> {
        Ok(diesel::sql_query("INSERT INTO build_upload_grants (id, build_id, attempt, token_digest,
            expires_at, consumed_at, outcome, created_at)
            SELECT $1, id, $3, $4, $5, NULL, NULL, $6 FROM builds
            WHERE id = $2 AND state = 'running' AND attempt = $3 AND deadline_at = $5
              AND NOT EXISTS (SELECT 1 FROM build_upload_grants WHERE build_id = $2 AND attempt = $3)
            ON CONFLICT (build_id, attempt) DO NOTHING")
            .bind::<SqlUuid, _>(value.id).bind::<SqlUuid, _>(value.build_id.0)
            .bind::<diesel::sql_types::Integer, _>(value.attempt)
            .bind::<diesel::sql_types::Binary, _>(value.token_digest.as_slice())
            .bind::<Timestamptz, _>(value.expires_at).bind::<Timestamptz, _>(value.created_at)
            .execute(self.connection).context("mint attempt-bound build grant")? == 1)
    }

    fn build_grant(&mut self, digest: &[u8; 32]) -> Result<Option<BuildUploadGrant>> {
        build_upload_grants::table
            .filter(build_upload_grants::token_digest.eq(digest.as_slice()))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read build grant by digest")?
            .map(Row::dto)
            .transpose()
    }

    fn build_attempt_grant(
        &mut self,
        build: BuildId,
        attempt: i32,
    ) -> Result<Option<BuildUploadGrant>> {
        build_upload_grants::table
            .filter(build_upload_grants::build_id.eq(build.0))
            .filter(build_upload_grants::attempt.eq(attempt))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read build attempt grant")?
            .map(Row::dto)
            .transpose()
    }

    fn lock_build_grant(&mut self, digest: &[u8; 32]) -> Result<bool> {
        let Some(grant) = self.build_grant(digest)? else {
            return Ok(false);
        };
        self.lock_build_upload(grant.id)
    }

    fn consume_build_grant(
        &mut self,
        id: Uuid,
        publication: PublicationId,
        clock: &dyn BuildClock,
    ) -> Result<bool> {
        if !self.lock_build_upload(id)? {
            return Ok(false);
        }
        let at = clock.now();
        Ok(diesel::sql_query("WITH consumed AS (
            UPDATE build_upload_grants g SET consumed_at = $3, outcome = 'accepted'
            FROM builds b, publications p
            WHERE g.id = $1 AND g.consumed_at IS NULL AND g.expires_at > $3
              AND b.id = g.build_id AND b.state = 'running' AND b.attempt = g.attempt
              AND b.lease_expires_at > $3 AND b.deadline_at > $3
              AND p.id = $2 AND p.state = 'ready' AND p.expired_at IS NULL
              AND p.project_id = b.project_id AND p.head_sha = b.head_sha AND p.config_path = b.config_path
              AND (b.publication_id IS NULL OR b.publication_id = p.id)
            RETURNING g.build_id)
            UPDATE builds SET publication_id = $2 WHERE id IN (SELECT build_id FROM consumed)")
            .bind::<SqlUuid, _>(id).bind::<SqlUuid, _>(publication.0).bind::<Timestamptz, _>(at)
            .execute(self.connection).context("consume build grant with ready upload winner")? == 1)
    }

    fn record_build_upload_outcome(&mut self, id: Uuid, outcome: UploadOutcome) -> Result<bool> {
        Ok(diesel::sql_query(
            "UPDATE build_upload_grants SET outcome = $2 WHERE id = $1
            AND (CASE $2 WHEN 'accepted' THEN 3 WHEN 'unavailable' THEN 1 ELSE 2 END)
              >= (CASE outcome WHEN 'accepted' THEN 3 WHEN 'unavailable' THEN 1
                  WHEN 'rejected' THEN 2 WHEN 'plan-required' THEN 2 ELSE 0 END)",
        )
        .bind::<SqlUuid, _>(id)
        .bind::<Text, _>(outcome.as_str())
        .execute(self.connection)
        .context("record ranked build upload outcome")?
            == 1)
    }
}
