//! Find or create the fixed sample identities through the HTTP routes' actions.

use mkc_domain::ids::{OrganizationId, ProjectId, UserId};

use crate::action::Action;
use crate::input::{CreateWorkspace, Name};
use crate::pagination::Pagination;
use crate::payload::Payload;
use crate::platform::error;
use crate::project_input::{CreateProject, RepositoryProject};
use crate::views::projects::ProjectSlugLookupView;
use crate::views::tokens::TokenCreated;
use crate::views::workspaces::WorkspaceSlugLookupView;

use super::error::{Error, ErrorResultExt, Failure, Result};
use super::identity_validation::{project, workspace};
use super::service::SeedService;

pub(super) const WORKSPACE_SLUG: &str = "mokly-ai";
pub(super) const PROJECT_SLUG: &str = "mokly-cloud";
pub(super) const WORKSPACE_NAME: &str = "Mokly";
pub(super) const PROJECT_NAME: &str = "Mokly Cloud";
pub(super) const REPOSITORY: &str = "mokly-ai/mokly-cloud";
pub(super) const CONFIG_PATH: &str = "mokly.config.json";

impl SeedService {
    pub(super) fn workspace(&self, actor: UserId) -> Result<OrganizationId> {
        let slug = WORKSPACE_SLUG
            .parse()
            .context("parse seed workspace slug")?;
        let found = match self.execute(actor, Action::WorkspaceBySlug(slug)) {
            Ok(Payload::WorkspaceSlugLookup(found)) => found,
            Err(error::Error::NotFound) => {
                let input = CreateWorkspace {
                    name: WORKSPACE_NAME.to_owned(),
                    slug: WORKSPACE_SLUG
                        .parse()
                        .context("parse seed workspace slug")?,
                };
                let Payload::Workspace(created) = self
                    .execute(actor, Action::CreateWorkspace(input))
                    .context("create seed workspace")?
                else {
                    return Err(Error::internal(Failure::UnexpectedReply));
                };
                WorkspaceSlugLookupView {
                    canonical_slug: created.slug.clone(),
                    workspace: created,
                }
            }
            Err(error) => return Err(Error::internal_with(error, "find seed workspace")),
            _ => return Err(Error::internal(Failure::UnexpectedReply)),
        };
        workspace(&found)?;
        Ok(found.workspace.id)
    }

    pub(super) fn project(&self, actor: UserId, workspace_id: OrganizationId) -> Result<ProjectId> {
        let workspace = WORKSPACE_SLUG
            .parse()
            .context("parse seed workspace slug")?;
        let slug = PROJECT_SLUG.parse().context("parse seed project slug")?;
        let found = match self.execute(actor, Action::ProjectBySlug(workspace, slug)) {
            Ok(Payload::ProjectSlugLookup(found)) => found,
            Err(error::Error::NotFound) => {
                let input = CreateProject::Repository(RepositoryProject {
                    name: PROJECT_NAME.to_owned(),
                    slug: PROJECT_SLUG.parse().context("parse seed project slug")?,
                    repository: REPOSITORY.to_owned(),
                    config_path: CONFIG_PATH.to_owned(),
                });
                let created = match self.execute(actor, Action::CreateProject(workspace_id, input))
                {
                    Err(error::Error::DuplicateProject(id)) => {
                        self.execute(actor, Action::Project(id))
                    }
                    result => result,
                }
                .context("create seed project")?;
                let Payload::Project(created) = created else {
                    return Err(Error::internal(Failure::UnexpectedReply));
                };
                ProjectSlugLookupView {
                    canonical_slug: created.slug.clone(),
                    canonical_workspace_slug: created.workspace_slug.clone(),
                    project: created,
                }
            }
            Err(error) => return Err(Error::internal_with(error, "find seed project")),
            _ => return Err(Error::internal(Failure::UnexpectedReply)),
        };
        project(&found, workspace_id)?;
        Ok(found.project.id)
    }

    pub(super) fn token(&self, actor: UserId, project: ProjectId) -> Result<TokenCreated> {
        let action = Action::CreateToken(
            project,
            Name {
                name: "Preview seed".to_owned(),
            },
        );
        match self
            .execute(actor, action)
            .context("create seed project token")?
        {
            Payload::Token(token) => Ok(token),
            _ => Err(Error::internal(Failure::UnexpectedReply)),
        }
    }

    pub(super) fn execute(&self, actor: UserId, action: Action) -> error::Result<Payload> {
        Ok(self
            .platform
            .execute(
                Some(actor),
                action,
                Pagination {
                    cursor: None,
                    limit: 50,
                },
            )?
            .payload)
    }
}
