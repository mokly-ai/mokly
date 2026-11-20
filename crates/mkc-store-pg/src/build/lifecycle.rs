//! Conditional progress, finalization and cancellation statements.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Integer, Nullable, Text, Timestamptz, Uuid as SqlUuid};
use mkc_db::schema::build::builds;
use mkc_domain::ids::{BuildId, ProjectId};
use mkc_store_interface::build::{Build, Builds};
use mkc_store_interface::build_attempt::BuildFinish;
use mkc_store_interface::build_check::BuildChecks;
use mkc_store_interface::build_state::BuildStep;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::publication::PublicationFailure;
use uuid::Uuid;

use crate::queries::PgQueries;

impl PgQueries<'_> {
    pub(super) fn record_step(
        &mut self,
        id: BuildId,
        lease: Uuid,
        step: BuildStep,
        at: DateTime<Utc>,
    ) -> Result<bool> {
        let changed = diesel::update(
            builds::table
                .find(id.0)
                .filter(builds::state.eq("running"))
                .filter(builds::lease_token.eq(lease)),
        )
        .set(builds::step.eq(step.as_str()))
        .execute(self.connection)
        .context("record fenced build step")?
            == 1;
        if changed {
            self.bump_build_check(id, at)?;
        }
        Ok(changed)
    }

    pub(super) fn finish(
        &mut self,
        id: BuildId,
        lease: Option<Uuid>,
        value: &BuildFinish,
    ) -> Result<bool> {
        let changed = diesel::sql_query(
            "UPDATE builds SET state = $3, failure_cause = $4,
            exit_code = $5, next_attempt_at = $6, lease_token = NULL, lease_expires_at = NULL,
            finished_at = CASE WHEN $3 = 'queued' THEN NULL ELSE $7 END, log_complete = true
            WHERE id = $1 AND ((state = 'running' AND lease_token = $2)
              OR (state = 'queued' AND $2::uuid IS NULL AND $3 = 'failed'))
              AND $3 <> 'running'
              AND (publication_id IS NULL OR $3 = 'published')",
        )
        .bind::<SqlUuid, _>(id.0)
        .bind::<Nullable<SqlUuid>, _>(lease)
        .bind::<Text, _>(value.state.as_str())
        .bind::<Nullable<Text>, _>(value.failure_cause.map(|v| v.as_str()))
        .bind::<Nullable<Integer>, _>(value.exit_code)
        .bind::<Timestamptz, _>(value.next_attempt_at)
        .bind::<Timestamptz, _>(value.at)
        .execute(self.connection)
        .context("finish or retry fenced build")?
            == 1;
        if changed {
            self.bump_build_check(id, value.at)?;
        }
        Ok(changed)
    }

    pub(super) fn cancel(
        &mut self,
        project: ProjectId,
        id: BuildId,
        at: DateTime<Utc>,
    ) -> Result<Option<Build>> {
        let changed = diesel::update(
            builds::table
                .find(id.0)
                .filter(builds::project_id.eq(project.0))
                .filter(builds::state.eq_any(["queued", "running"]))
                .filter(builds::publication_id.is_null()),
        )
        .set((
            builds::state.eq("cancelled"),
            builds::finished_at.eq(at),
            builds::lease_token.eq(None::<Uuid>),
            builds::lease_expires_at.eq(None::<DateTime<Utc>>),
            builds::log_complete.eq(true),
        ))
        .execute(self.connection)
        .context("cancel uncommitted project build")?
            == 1;
        let current = self.build(project, id)?;
        if changed {
            if let Some(started) = current.as_ref().and_then(|build| build.started_at) {
                self.close_build_uploads(id, started, PublicationFailure::Expired, at)?;
            }
            self.bump_build_check(id, at)?;
        }
        Ok(current)
    }
}
