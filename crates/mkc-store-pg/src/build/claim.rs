//! Organization-serialized candidate locks and fenced attempt starts.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Nullable, Timestamptz, Uuid as SqlUuid};
use mkc_db::schema::build_output::build_log_chunks;
use mkc_domain::ids::BuildId;
use mkc_store_interface::build::Build;
use mkc_store_interface::build_attempt::BuildAttempt;
use mkc_store_interface::build_check::BuildChecks;
use mkc_store_interface::build_clock::BuildClock;
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::queries::PgQueries;

use super::row::Row;

#[derive(QueryableByName)]
struct OrganizationLock {
    #[diesel(sql_type = SqlUuid)]
    id: Uuid,
}

impl PgQueries<'_> {
    pub(super) fn claim(&mut self, clock: &dyn BuildClock) -> Result<Option<Build>> {
        let organization = diesel::sql_query(include_str!("claim_organization.sql"))
            .bind::<Timestamptz, _>(clock.now())
            .get_result::<OrganizationLock>(self.connection)
            .optional()
            .context("serialize build claims per organization")?;
        let Some(organization) = organization else {
            return Ok(None);
        };
        let Some(candidate) = self.claim_candidate(organization.id, clock.now(), None)? else {
            return Ok(None);
        };
        self.claim_candidate(organization.id, clock.now(), Some(candidate.id))?
            .map(Row::dto)
            .transpose()
    }

    fn claim_candidate(
        &mut self,
        organization: Uuid,
        now: DateTime<Utc>,
        candidate: Option<Uuid>,
    ) -> Result<Option<Row>> {
        diesel::sql_query(include_str!("claim_build.sql"))
            .bind::<Timestamptz, _>(now)
            .bind::<SqlUuid, _>(organization)
            .bind::<Nullable<SqlUuid>, _>(candidate)
            .get_result::<Row>(self.connection)
            .optional()
            .context("lock and recheck due or expired build")
    }

    pub(super) fn start_attempt(
        &mut self,
        id: BuildId,
        attempt: &BuildAttempt,
    ) -> Result<Option<Build>> {
        diesel::sql_query(
            "SELECT o.id FROM organizations o JOIN projects p ON p.organization_id = o.id
            JOIN builds b ON b.project_id = p.id WHERE b.id = $1 FOR UPDATE OF o",
        )
        .bind::<SqlUuid, _>(id.0)
        .get_result::<OrganizationLock>(self.connection)
        .optional()
        .context("serialize attempt start per organization")?;
        let row = diesel::sql_query(include_str!("start.sql"))
            .bind::<SqlUuid, _>(id.0)
            .bind::<Timestamptz, _>(attempt.now)
            .bind::<SqlUuid, _>(attempt.operation_id)
            .bind::<SqlUuid, _>(attempt.lease_token)
            .bind::<Timestamptz, _>(attempt.lease_expires_at)
            .bind::<Timestamptz, _>(attempt.deadline_at)
            .get_result::<Row>(self.connection)
            .optional()
            .context("start fenced build attempt")?;
        let Some(row) = row else {
            return Ok(None);
        };
        diesel::delete(build_log_chunks::table.filter(build_log_chunks::build_id.eq(id.0)))
            .execute(self.connection)
            .context("delete earlier attempts' log chunks")?;
        self.bump_build_check(id, attempt.now)?;
        row.dto().map(Some)
    }
}
