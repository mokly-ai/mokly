//! Check identity and durable rerequest persistence.

use diesel::prelude::*;
use diesel::query_dsl::methods;
use mkc_db::schema::github_refs::github_check_runs;
use mkc_domain::ids::{ProjectId, RepositoryId};
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use mkc_store_interface::github_check::{CheckRun, GitHubChecks};
use uuid::Uuid;

use crate::github_rows::check::Row;
use crate::publication_row::InvalidRecord;
use crate::queries::PgQueries;

impl GitHubChecks for PgQueries<'_> {
    fn record_github_check(&mut self, value: &CheckRun) -> Result<()> {
        let insert = diesel::insert_into(github_check_runs::table)
            .values(Row::record(value))
            .on_conflict(github_check_runs::external_id)
            .do_update()
            .set(github_check_runs::github_id.eq(value.github_id));
        let changed = methods::FilterDsl::filter(
            insert,
            github_check_runs::project_id
                .eq(value.project_id.0)
                .and(github_check_runs::repository_id.eq(value.repository_id.0))
                .and(github_check_runs::head_sha.eq(&value.head_sha)),
        )
        .execute(self.connection)
        .context("record acknowledged GitHub check identity")?;
        if changed != 1 {
            return Err(Error::internal(InvalidRecord));
        }
        Ok(())
    }

    fn save_github_check(&mut self, value: &CheckRun) -> Result<()> {
        let row = Row::record(value);
        diesel::insert_into(github_check_runs::table)
            .values(&row)
            .on_conflict(github_check_runs::id)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save GitHub check run")?;
        Ok(())
    }

    fn github_check(&mut self, github_id: i64) -> Result<Option<CheckRun>> {
        github_check_runs::table
            .filter(github_check_runs::github_id.eq(github_id))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read GitHub check run")?
            .map(Row::dto)
            .transpose()
    }

    fn github_check_by_external_id(
        &mut self,
        project: ProjectId,
        external_id: &str,
    ) -> Result<Option<CheckRun>> {
        github_check_runs::table
            .filter(github_check_runs::project_id.eq(project.0))
            .filter(github_check_runs::external_id.eq(external_id))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read GitHub check reconciliation key")?
            .map(Row::dto)
            .transpose()
    }

    fn rerequested_github_checks(&mut self, prefix: &str, limit: i64) -> Result<Vec<CheckRun>> {
        self.claim_check_rerequests(prefix, limit)
    }

    fn clear_github_check_rerequest(&mut self, id: Uuid) -> Result<()> {
        diesel::update(github_check_runs::table.find(id))
            .set(github_check_runs::rerequested.eq(false))
            .execute(self.connection)
            .context("consume GitHub check rerequest")?;
        Ok(())
    }

    fn github_checks(&mut self, repository: RepositoryId) -> Result<Vec<CheckRun>> {
        github_check_runs::table
            .filter(github_check_runs::repository_id.eq(repository.0))
            .order(github_check_runs::id.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list GitHub check runs")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }
}
