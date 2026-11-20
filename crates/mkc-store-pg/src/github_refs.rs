//! Current PR and branch state queries, including observed deletions.

use diesel::prelude::*;
use diesel::query_dsl::methods;
use mkc_db::schema::github_refs::{github_branches, github_pull_requests};
use mkc_domain::ids::RepositoryId;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_refs::{Branch, GitHubRefs, PullRequest};

use crate::github_rows::{branch, pull_request};
use crate::queries::PgQueries;

impl GitHubRefs for PgQueries<'_> {
    fn save_github_pull_request(&mut self, value: &PullRequest) -> Result<()> {
        let row = pull_request::Row::record(value);
        let update = diesel::insert_into(github_pull_requests::table)
            .values(&row)
            .on_conflict((
                github_pull_requests::repository_id,
                github_pull_requests::number,
            ))
            .do_update()
            .set(&row);
        methods::FilterDsl::filter(
            update,
            github_pull_requests::updated_at.le(value.updated_at),
        )
        .execute(self.connection)
        .context("save GitHub pull request")?;
        Ok(())
    }

    fn github_pull_requests(&mut self, repository: RepositoryId) -> Result<Vec<PullRequest>> {
        github_pull_requests::table
            .filter(github_pull_requests::repository_id.eq(repository.0))
            .order(github_pull_requests::number.asc())
            .select(pull_request::Row::as_select())
            .load(self.connection)
            .context("list GitHub pull requests")?
            .into_iter()
            .map(pull_request::Row::dto)
            .collect()
    }

    fn save_github_branch(&mut self, value: &Branch) -> Result<()> {
        let row = branch::Row::record(value);
        let update = diesel::insert_into(github_branches::table)
            .values(&row)
            .on_conflict((github_branches::repository_id, github_branches::name))
            .do_update()
            .set(&row);
        methods::FilterDsl::filter(update, github_branches::updated_at.le(value.updated_at))
            .execute(self.connection)
            .context("save GitHub branch")?;
        Ok(())
    }

    fn github_branches(&mut self, repository: RepositoryId) -> Result<Vec<Branch>> {
        github_branches::table
            .filter(github_branches::repository_id.eq(repository.0))
            .order(github_branches::name.asc())
            .select(branch::Row::as_select())
            .load(self.connection)
            .context("list GitHub branches")?
            .into_iter()
            .map(branch::Row::dto)
            .collect()
    }
}
