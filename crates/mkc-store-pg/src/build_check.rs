//! Build check state bumps, live claims and retry-fenced delivery outcomes.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Bool, Integer, Nullable, Timestamptz, Uuid as SqlUuid};
use mkc_db::schema::build_output::build_checks;
use mkc_domain::ids::{BuildId, ProjectId};
use mkc_store_interface::build_check::{BuildCheck, BuildChecks};
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(QueryableByName)]
#[diesel(table_name = build_checks)]
struct Row {
    build_id: Uuid,
    version: i64,
    delivered_version: i64,
    attempts: i32,
    permanent_failures: i32,
    next_attempt_at: DateTime<Utc>,
    dead_lettered_at: Option<DateTime<Utc>>,
    claim_expires_at: Option<DateTime<Utc>>,
}

impl Row {
    fn dto(self) -> BuildCheck {
        BuildCheck {
            build_id: self.build_id.into(),
            version: self.version,
            delivered_version: self.delivered_version,
            attempts: self.attempts,
            permanent_failures: self.permanent_failures,
            next_attempt_at: self.next_attempt_at,
            dead_lettered_at: self.dead_lettered_at,
            claim_expires_at: self.claim_expires_at,
        }
    }
}

impl BuildChecks for PgQueries<'_> {
    fn bump_build_check(&mut self, build: BuildId, at: DateTime<Utc>) -> Result<()> {
        diesel::sql_query("INSERT INTO build_checks (build_id, next_attempt_at) VALUES ($1, $2)
            ON CONFLICT (build_id) DO UPDATE SET version = build_checks.version + 1,
            next_attempt_at = EXCLUDED.next_attempt_at, dead_lettered_at = NULL, permanent_failures = 0")
            .bind::<SqlUuid, _>(build.0).bind::<Timestamptz, _>(at).execute(self.connection)
            .context("bump build check without ending its claim")?;
        Ok(())
    }

    fn pending_build_checks(
        &mut self,
        at: DateTime<Utc>,
        limit: i64,
        project: Option<ProjectId>,
    ) -> Result<Vec<BuildCheck>> {
        Ok(diesel::sql_query("SELECT c.* FROM build_checks c JOIN builds b ON b.id = c.build_id
            WHERE c.delivered_version < c.version AND c.next_attempt_at <= $1
              AND c.dead_lettered_at IS NULL AND (c.claim_expires_at IS NULL OR c.claim_expires_at <= $1)
              AND ($3::uuid IS NULL OR b.project_id = $3)
            ORDER BY c.next_attempt_at, c.build_id LIMIT $2")
            .bind::<Timestamptz, _>(at).bind::<BigInt, _>(limit.clamp(1, 100))
            .bind::<Nullable<SqlUuid>, _>(project.map(|id| id.0)).load::<Row>(self.connection)
            .context("read due unclaimed build checks")?.into_iter().map(Row::dto).collect())
    }

    fn claim_build_check(
        &mut self,
        build: BuildId,
        attempts: i32,
        at: DateTime<Utc>,
    ) -> Result<Option<BuildCheck>> {
        Ok(diesel::sql_query(
            "UPDATE build_checks SET attempts = attempts + 1,
            claim_expires_at = $3 + INTERVAL '5 minutes'
            WHERE build_id = $1 AND attempts = $2 AND delivered_version < version
              AND dead_lettered_at IS NULL AND next_attempt_at <= $3
              AND (claim_expires_at IS NULL OR claim_expires_at <= $3) RETURNING *",
        )
        .bind::<SqlUuid, _>(build.0)
        .bind::<Integer, _>(attempts)
        .bind::<Timestamptz, _>(at)
        .get_result::<Row>(self.connection)
        .optional()
        .context("claim one due build check")?
        .map(Row::dto))
    }

    fn deliver_build_check(&mut self, build: BuildId, attempts: i32, version: i64) -> Result<bool> {
        Ok(diesel::sql_query(
            "UPDATE build_checks SET delivered_version = $3, claim_expires_at = NULL
            WHERE build_id = $1 AND attempts = $2 AND claim_expires_at IS NOT NULL
              AND dead_lettered_at IS NULL AND delivered_version < version
              AND delivered_version < $3 AND $3 <= version",
        )
        .bind::<SqlUuid, _>(build.0)
        .bind::<Integer, _>(attempts)
        .bind::<BigInt, _>(version)
        .execute(self.connection)
        .context("acknowledge claimed build check version")?
            == 1)
    }

    fn retry_build_check(
        &mut self,
        build: BuildId,
        attempts: i32,
        permanent: bool,
        next: DateTime<Utc>,
        at: DateTime<Utc>,
    ) -> Result<bool> {
        Ok(diesel::sql_query(
            "UPDATE build_checks SET next_attempt_at = $4, claim_expires_at = NULL,
            permanent_failures = LEAST(5, permanent_failures + CASE WHEN $3 THEN 1 ELSE 0 END),
            dead_lettered_at = CASE WHEN $3 AND permanent_failures >= 4 THEN $5 ELSE NULL END
            WHERE build_id = $1 AND attempts = $2 AND claim_expires_at IS NOT NULL
              AND dead_lettered_at IS NULL AND delivered_version < version",
        )
        .bind::<SqlUuid, _>(build.0)
        .bind::<Integer, _>(attempts)
        .bind::<Bool, _>(permanent)
        .bind::<Timestamptz, _>(next)
        .bind::<Timestamptz, _>(at)
        .execute(self.connection)
        .context("record fenced build check failure")?
            == 1)
    }

    fn requeue_build_check(&mut self, build: BuildId, at: DateTime<Utc>) -> Result<bool> {
        Ok(diesel::sql_query(
            "UPDATE build_checks SET attempts = attempts + 1, permanent_failures = 0,
            next_attempt_at = $2, dead_lettered_at = NULL, claim_expires_at = NULL
            WHERE build_id = $1 AND delivered_version < version AND dead_lettered_at IS NOT NULL",
        )
        .bind::<SqlUuid, _>(build.0)
        .bind::<Timestamptz, _>(at)
        .execute(self.connection)
        .context("requeue dead-lettered build check")?
            == 1)
    }

    fn build_check_dead_letter_count(&mut self) -> Result<i64> {
        build_checks::table
            .filter(build_checks::delivered_version.lt(build_checks::version))
            .filter(build_checks::dead_lettered_at.is_not_null())
            .count()
            .get_result(self.connection)
            .context("count undelivered build check dead letters")
    }
}
