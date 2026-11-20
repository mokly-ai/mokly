//! Implementation of the transactional build query interface.

use chrono::{DateTime, Duration, Utc};
use diesel::prelude::*;
use mkc_db::schema::build::builds;
use mkc_domain::ids::{BuildId, ProjectId};
use mkc_store_interface::build::{Build, Builds, NewBuild};
use mkc_store_interface::build_attempt::{BuildAttempt, BuildFinish};
use mkc_store_interface::build_clock::BuildClock;
use mkc_store_interface::build_state::BuildStep;
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::queries::PgQueries;

use super::row::Row;

impl Builds for PgQueries<'_> {
    fn build_by_id(&mut self, id: BuildId) -> Result<Option<Build>> {
        builds::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read trusted outbox build")?
            .map(Row::dto)
            .transpose()
    }
    fn build(&mut self, project: ProjectId, id: BuildId) -> Result<Option<Build>> {
        builds::table
            .find(id.0)
            .filter(builds::project_id.eq(project.0))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read project build")?
            .map(Row::dto)
            .transpose()
    }

    fn active_build(&mut self, project: ProjectId, head: &str) -> Result<Option<Build>> {
        builds::table
            .filter(builds::project_id.eq(project.0))
            .filter(builds::head_sha.eq(head))
            .filter(builds::state.eq_any(["queued", "running"]))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read active head build")?
            .map(Row::dto)
            .transpose()
    }

    fn schedule_build(&mut self, value: &NewBuild) -> Result<()> {
        self.schedule(value)
    }

    fn claim_build(&mut self, clock: &dyn BuildClock) -> Result<Option<Build>> {
        self.claim(clock)
    }

    fn start_build(&mut self, id: BuildId, attempt: &BuildAttempt) -> Result<Option<Build>> {
        self.start_attempt(id, attempt)
    }

    fn renew_build(
        &mut self,
        id: BuildId,
        lease: Uuid,
        clock: &dyn BuildClock,
        duration: Duration,
    ) -> Result<bool> {
        builds::table
            .find(id.0)
            .select(builds::id)
            .for_update()
            .first::<Uuid>(self.connection)
            .optional()
            .context("lock build before reading renewal clock")?;
        let at = clock.now();
        Ok(diesel::update(
            builds::table
                .find(id.0)
                .filter(builds::state.eq("running"))
                .filter(builds::lease_token.eq(lease))
                .filter(builds::lease_expires_at.gt(at)),
        )
        .set(builds::lease_expires_at.eq(at + duration))
        .execute(self.connection)
        .context("renew build lease")?
            == 1)
    }

    fn set_build_step(
        &mut self,
        id: BuildId,
        lease: Uuid,
        step: BuildStep,
        at: DateTime<Utc>,
    ) -> Result<bool> {
        self.record_step(id, lease, step, at)
    }

    fn finish_build(
        &mut self,
        id: BuildId,
        lease: Option<Uuid>,
        finish: &BuildFinish,
    ) -> Result<bool> {
        self.finish(id, lease, finish)
    }

    fn cancel_build(
        &mut self,
        project: ProjectId,
        id: BuildId,
        at: DateTime<Utc>,
    ) -> Result<Option<Build>> {
        self.cancel(project, id, at)
    }

    fn prune_builds(&mut self, before: DateTime<Utc>, limit: i64) -> Result<i64> {
        self.prune(before, limit)
    }

    fn build_operation(&mut self, id: BuildId) -> Result<Option<Uuid>> {
        builds::table
            .find(id.0)
            .filter(builds::state.eq("running"))
            .select(builds::attempt_operation_id)
            .first::<Option<Uuid>>(self.connection)
            .optional()
            .context("read running build operation")
            .map(Option::flatten)
    }
}
