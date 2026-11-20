//! Publication lifecycle, idempotency and alias queries.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Bool, Nullable, Timestamptz, Uuid as SqlUuid};
use mkc_db::schema::publication::publications;
use mkc_db::schema::publication_events::{catalogue_grants, publication_branch_aliases};
use mkc_db::schema::publication_screens::publication_screen_views;
use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationMetadata, Publications,
};
use mkc_store_interface::publication_changes::Changes;
use uuid::Uuid;

use crate::publication_changes_row::ChangesRow;
use crate::publication_row::PublicationRow;
use crate::queries::PgQueries;

impl Publications for PgQueries<'_> {
    fn publication(&mut self, id: PublicationId) -> Result<Option<Publication>> {
        publications::table
            .find(id.0)
            .select(PublicationRow::as_select())
            .first(self.connection)
            .optional()
            .context("read publication")?
            .map(PublicationRow::dto)
            .transpose()
    }

    fn publications(&mut self, project: ProjectId) -> Result<Vec<Publication>> {
        publications::table
            .filter(publications::project_id.eq(project.0))
            .order((publications::created_at.desc(), publications::id.desc()))
            .select(PublicationRow::as_select())
            .load(self.connection)
            .context("read publication history")?
            .into_iter()
            .map(PublicationRow::dto)
            .collect()
    }

    fn insert_publication(&mut self, value: &Publication) -> Result<()> {
        diesel::insert_into(publications::table)
            .values(PublicationRow::record(value)?)
            .execute(self.connection)
            .context("admit upload attempt")?;
        Ok(())
    }

    fn validate_publication(
        &mut self,
        id: PublicationId,
        value: &PublicationMetadata,
    ) -> Result<bool> {
        Ok(diesel::update(
            publications::table
                .find(id.0)
                .filter(publications::state.eq("uploading")),
        )
        .set((
            publications::branch.eq(&value.branch),
            publications::head_sha.eq(&value.head_sha),
            publications::base_ref.eq(&value.base_ref),
            publications::base_sha.eq(&value.base_sha),
            publications::pull_request.eq(value.pull_request),
            publications::config_path.eq(&value.config_path),
            publications::exported_at.eq(value.exported_at),
            publications::state.eq("validating"),
        ))
        .execute(self.connection)
        .context("attach validated publication metadata")?
            == 1)
    }

    fn ready_publication(&mut self, id: PublicationId, changes: Changes) -> Result<bool> {
        Ok(diesel::update(
            publications::table
                .find(id.0)
                .filter(publications::state.eq("validating"))
                .filter(diesel::dsl::sql::<Bool>("deadline > clock_timestamp()")),
        )
        .set((
            publications::state.eq("ready"),
            ChangesRow::record(Some(changes))?,
        ))
        .execute(self.connection)
        .context("commit publication ready")?
            == 1)
    }

    fn fail_publication(&mut self, id: PublicationId, failure: PublicationFailure) -> Result<bool> {
        Ok(diesel::update(
            publications::table
                .find(id.0)
                .filter(publications::state.eq_any(["uploading", "validating"])),
        )
        .set((
            publications::state.eq("failed"),
            publications::failure_code.eq(failure.as_str()),
        ))
        .execute(self.connection)
        .context("fail unfinished publication")?
            == 1)
    }

    fn publication_by_identity(
        &mut self,
        project: ProjectId,
        head: &str,
        config: &str,
    ) -> Result<Option<Publication>> {
        publications::table
            .filter(publications::project_id.eq(project.0))
            .filter(publications::head_sha.eq(head))
            .filter(publications::config_path.eq(config))
            .filter(publications::state.eq("ready"))
            .filter(publications::expired_at.is_null())
            .select(PublicationRow::as_select())
            .first(self.connection)
            .optional()
            .context("read ready idempotency winner")?
            .map(PublicationRow::dto)
            .transpose()
    }

    fn fail_build_uploads(
        &mut self,
        build: BuildId,
        since: DateTime<Utc>,
        failure: PublicationFailure,
        at: DateTime<Utc>,
    ) -> Result<i64> {
        self.close_build_uploads(build, since, failure, at)
    }

    fn latest_publication(
        &mut self,
        project: ProjectId,
        branch: &str,
    ) -> Result<Option<Publication>> {
        publications::table
            .filter(publications::project_id.eq(project.0))
            .filter(publications::branch.eq(branch))
            .filter(publications::state.eq("ready"))
            .filter(publications::expired_at.is_null())
            .order((publications::created_at.desc(), publications::id.desc()))
            .select(PublicationRow::as_select())
            .first(self.connection)
            .optional()
            .context("resolve latest ready branch publication")?
            .map(PublicationRow::dto)
            .transpose()
    }

    fn expire_publication(&mut self, id: PublicationId, at: DateTime<Utc>) -> Result<bool> {
        let changed = diesel::update(
            publications::table
                .find(id.0)
                .filter(publications::state.eq("ready"))
                .filter(publications::expired_at.is_null()),
        )
        .set((
            publications::state.eq("expired"),
            publications::expired_at.eq(at),
        ))
        .execute(self.connection)
        .context("expire retained publication")?;
        if changed == 1 {
            diesel::delete(
                catalogue_grants::table.filter(catalogue_grants::publication_id.eq(id.0)),
            )
            .execute(self.connection)
            .context("revoke expired publication grants")?;
            diesel::delete(
                publication_screen_views::table
                    .filter(publication_screen_views::publication_id.eq(id.0)),
            )
            .execute(self.connection)
            .context("release expired screen selections")?;
        }
        Ok(changed == 1)
    }

    fn delete_failed_publication(
        &mut self,
        id: PublicationId,
        before: DateTime<Utc>,
    ) -> Result<bool> {
        Ok(diesel::delete(
            publications::table
                .find(id.0)
                .filter(publications::state.eq("failed"))
                .filter(publications::created_at.le(before)),
        )
        .execute(self.connection)
        .context("prune failed publication history")?
            == 1)
    }

    /// Each branch of the union matches a partial index of the retention-index
    /// migration, so the cutoff is an index condition, not a worker filter.
    fn publication_candidates(
        &mut self,
        now: DateTime<Utc>,
        retained_before: DateTime<Utc>,
        after: Option<PublicationId>,
        limit: i64,
    ) -> Result<Vec<Publication>> {
        diesel::sql_query(include_str!("retention_candidates.sql"))
            .bind::<Timestamptz, _>(now)
            .bind::<Timestamptz, _>(retained_before)
            .bind::<Nullable<SqlUuid>, _>(after.map(|id| id.0))
            .bind::<BigInt, _>(limit.clamp(1, 1000))
            .load::<PublicationRow>(self.connection)
            .context("list retention candidates")?
            .into_iter()
            .map(PublicationRow::dto)
            .collect()
    }

    fn insert_branch_alias(&mut self, alias: &str, project: ProjectId, branch: &str) -> Result<()> {
        diesel::insert_into(publication_branch_aliases::table)
            .values((
                publication_branch_aliases::alias.eq(alias),
                publication_branch_aliases::project_id.eq(project.0),
                publication_branch_aliases::branch.eq(branch),
            ))
            .on_conflict_do_nothing()
            .execute(self.connection)
            .context("register branch alias")?;
        Ok(())
    }

    fn branch_alias(&mut self, alias: &str) -> Result<Option<Publication>> {
        let record: Option<(Uuid, String)> = publication_branch_aliases::table
            .find(alias)
            .select((
                publication_branch_aliases::project_id,
                publication_branch_aliases::branch,
            ))
            .first(self.connection)
            .optional()
            .context("read branch alias identity")?;
        match record {
            Some((project, branch)) => self.latest_publication(project.into(), &branch),
            None => Ok(None),
        }
    }
}
