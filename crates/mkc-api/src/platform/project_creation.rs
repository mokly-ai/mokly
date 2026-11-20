//! Project creation with an installed repository or a portable CLI identity.

use mkc_domain::ids::{OrganizationId, RepositoryId};
use mkc_domain::repository::RepositoryIdentity;
use mkc_domain::validation;
use mkc_domain::values::Role;
use mkc_publications::build_eligibility::BuildEligibility;
use mkc_store_interface::error;
use mkc_store_interface::grant::Grant;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Queries;

use crate::input::CreateProject;
use crate::payload::{Payload, Reply};

use super::error::{Error, ErrorResultExt, Result};
use super::execution::Execution;
use super::projection;

impl Execution<'_> {
    pub(super) fn create_project(
        &self,
        queries: &mut dyn Queries,
        workspace_id: OrganizationId,
        input: &CreateProject,
    ) -> Result<Reply> {
        let role = self.workspace_role(queries, workspace_id)?;
        if role < Role::Member {
            return Err(Error::Forbidden);
        }
        let (repository, link) = self.project_repository(queries, workspace_id, input)?;
        if !validation::config_path(input.config_path()) {
            return Err(Error::InvalidInput);
        }
        let name = validation::name(input.name()).ok_or(Error::InvalidInput)?;
        if let Some(existing) = queries
            .projects(workspace_id)
            .context("projects query")?
            .into_iter()
            .find(|p| {
                p.repository.eq_ignore_ascii_case(&repository)
                    && p.config_path == input.config_path()
            })
        {
            return Err(Error::DuplicateProject(existing.id));
        }
        let project = Project {
            id: self.id.into(),
            organization_id: workspace_id,
            name,
            slug: input.slug().clone(),
            repository,
            config_path: input.config_path().to_owned(),
            visibility: self
                .entitlements
                .default_visibility(queries, workspace_id)?,
            require_approval: false,
            automatic_builds: link.is_some(),
            version: 1,
        };
        match queries.insert_project(&project) {
            Ok(()) => {}
            Err(error::Error::SlugTaken) => {
                let suggestion =
                    self.project_slug_recovery(queries, workspace_id, &project.slug)?;
                return Err(Error::SlugTaken(suggestion.into_string()));
            }
            Err(error::Error::Internal(source)) => {
                return Err(Error::internal_context(source, "insert project query"));
            }
        }
        if let Some(repository_id) = link {
            queries
                .link_github_project(project.id, repository_id)
                .context("link project to installed repository")?;
        }
        queries
            .insert_grant(&Grant {
                id: self.second_id.into(),
                project_id: project.id,
                user_id: self.actor()?,
                role: Role::Admin,
                version: 1,
            })
            .context("insert grant query")?;
        let workspace = queries
            .organization(workspace_id)
            .context("workspace query")?
            .ok_or(Error::NotFound)?;
        let available = self
            .access(queries, project.id)
            .context("project build availability")?
            .is_some();
        Ok(Reply::created(Payload::Project(projection::project(
            project,
            &workspace,
            Some(Role::Admin),
            available,
        ))))
    }

    fn project_repository(
        &self,
        queries: &mut dyn Queries,
        workspace_id: OrganizationId,
        input: &CreateProject,
    ) -> Result<(String, Option<RepositoryId>)> {
        match input {
            CreateProject::Repository(input) => Ok((
                RepositoryIdentity::parse(&input.repository)
                    .ok_or(Error::InvalidInput)?
                    .canonical(),
                None,
            )),
            CreateProject::Installed(input) => {
                let installed = queries
                    .github_repository(RepositoryId(input.repository_id))
                    .context("resolve installed project repository")?
                    .filter(|repository| repository.active)
                    .ok_or(Error::NotFound)?;
                let installation = queries
                    .github_installation(installed.installation_id)
                    .context("authorize project installation")?
                    .ok_or(Error::NotFound)?;
                if !installation.active
                    || !installation.connected
                    || installation.organization_id != Some(workspace_id)
                {
                    return Err(Error::NotFound);
                }
                Ok((installed.full_name, Some(installed.id)))
            }
        }
    }
}
