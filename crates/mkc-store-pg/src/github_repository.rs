//! Installed repository persistence and explicit project associations.

use diesel::prelude::*;
use mkc_db::schema::github_installation::{github_project_repositories, github_repositories};
use mkc_domain::ids::{InstallationId, ProjectId, RepositoryId};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_repository::{GitHubRepositories, Repository};
use mkc_store_interface::project::Project;
use uuid::Uuid;

use crate::github_rows::repository::Row;
use crate::project;
use crate::queries::PgQueries;

impl GitHubRepositories for PgQueries<'_> {
    fn github_repository(&mut self, id: RepositoryId) -> Result<Option<Repository>> {
        github_repositories::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read GitHub repository")?
            .map(Row::dto)
            .transpose()
    }

    fn github_repositories(&mut self, installation: InstallationId) -> Result<Vec<Repository>> {
        github_repositories::table
            .filter(github_repositories::installation_id.eq(installation.0))
            .order(github_repositories::id.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list GitHub repositories")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }

    fn save_github_repository(&mut self, value: &Repository) -> Result<()> {
        let row = Row::record(value);
        diesel::insert_into(github_repositories::table)
            .values(&row)
            .on_conflict(github_repositories::id)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save GitHub repository")?;
        Ok(())
    }

    fn link_github_project(&mut self, project: ProjectId, repository: RepositoryId) -> Result<()> {
        diesel::insert_into(github_project_repositories::table)
            .values((
                github_project_repositories::project_id.eq(project.0),
                github_project_repositories::repository_id.eq(repository.0),
            ))
            .execute(self.connection)
            .context("link GitHub project")?;
        Ok(())
    }

    fn github_repository_projects(&mut self, repository: RepositoryId) -> Result<Vec<Project>> {
        diesel::sql_query(
            "SELECT p.* FROM projects p JOIN github_project_repositories binding
            ON binding.project_id = p.id WHERE binding.repository_id = $1 ORDER BY p.id",
        )
        .bind::<diesel::sql_types::Uuid, _>(repository.0)
        .load::<project::Row>(self.connection)
        .context("read projects bound to repository")?
        .into_iter()
        .map(project::Row::dto)
        .collect()
    }

    fn github_project_repository(&mut self, project: ProjectId) -> Result<Option<Repository>> {
        let repository: Option<Uuid> = github_project_repositories::table
            .find(project.0)
            .select(github_project_repositories::repository_id)
            .first(self.connection)
            .optional()
            .context("read GitHub project link")?;
        match repository {
            Some(id) => self.github_repository(id.into()),
            None => Ok(None),
        }
    }
}
