//! Parent-first bounded claims shared by both Re-run workers.

use diesel::prelude::*;
use diesel::sql_types::{Array, Uuid as SqlUuid};
use mkc_db::schema::github_refs::github_check_runs;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_check::CheckRun;
use uuid::Uuid;

use crate::github_rows::check::Row;
use crate::queries::PgQueries;

#[derive(QueryableByName)]
struct Locked {
    #[diesel(sql_type = SqlUuid)]
    id: Uuid,
}

impl PgQueries<'_> {
    pub(crate) fn claim_check_rerequests(
        &mut self,
        prefix: &str,
        limit: i64,
    ) -> Result<Vec<CheckRun>> {
        let pattern = format!("{prefix}%");
        let candidates = github_check_runs::table
            .filter(github_check_runs::rerequested.eq(true))
            .filter(github_check_runs::external_id.like(&pattern))
            .order(github_check_runs::id.asc())
            .limit(limit.clamp(1, 100))
            .select(github_check_runs::id)
            .load::<Uuid>(self.connection)
            .context("select bounded Re-run candidates without child locks")?;
        if candidates.is_empty() {
            return Ok(Vec::new());
        }
        let organizations = diesel::sql_query(
            "SELECT o.id FROM organizations o WHERE o.id IN (
                SELECT p.organization_id FROM projects p
                JOIN github_check_runs c ON c.project_id = p.id WHERE c.id = ANY($1))
             ORDER BY o.id FOR KEY SHARE OF o SKIP LOCKED",
        )
        .bind::<Array<SqlUuid>, _>(&candidates)
        .load::<Locked>(self.connection)
        .context("lock Re-run organizations in UUID order before projects")?
        .into_iter()
        .map(|row| row.id)
        .collect::<Vec<_>>();
        let projects = diesel::sql_query(
            "SELECT p.id FROM projects p WHERE p.organization_id = ANY($2)
             AND p.id IN (SELECT project_id FROM github_check_runs WHERE id = ANY($1))
             ORDER BY p.id FOR UPDATE OF p SKIP LOCKED",
        )
        .bind::<Array<SqlUuid>, _>(&candidates)
        .bind::<Array<SqlUuid>, _>(&organizations)
        .load::<Locked>(self.connection)
        .context("lock Re-run projects in UUID order before checks")?
        .into_iter()
        .map(|row| row.id)
        .collect::<Vec<_>>();
        github_check_runs::table
            .filter(github_check_runs::id.eq_any(candidates))
            .filter(github_check_runs::project_id.eq_any(projects))
            .filter(github_check_runs::rerequested.eq(true))
            .filter(github_check_runs::external_id.like(pattern))
            .order(github_check_runs::id.asc())
            .for_update()
            .skip_locked()
            .select(Row::as_select())
            .load(self.connection)
            .context("claim marked checks after their complete parent batch")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }
}
