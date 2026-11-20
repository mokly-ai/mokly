//! Project identity, additive access, visibility and deletion.

use mkc_domain::validation;
use mkc_domain::values::{Role, Visibility};
use mkc_publications::build_eligibility::BuildEligibility;
use mkc_store_interface::error::Error as StoreError;
use mkc_store_interface::store::Queries;

use crate::action::Action;
use crate::payload::{Payload, Reply};

use super::error::{Error, ErrorResultExt, Result};
use super::execution::Execution;
use super::{policy, projection};

impl Execution<'_> {
    pub(super) fn projects(&self, queries: &mut dyn Queries) -> Result<Reply> {
        match self.action {
            Action::Projects(workspace_id) => {
                self.workspace_role(queries, *workspace_id)?;
                let workspace = queries
                    .organization(*workspace_id)
                    .context("workspace query")?
                    .ok_or(Error::NotFound)?;
                let mut projects = Vec::new();
                for project in queries.projects(*workspace_id).context("projects query")? {
                    let (project, role) = self.project_access(queries, project.id)?;
                    let available = self
                        .access(queries, project.id)
                        .context("project build availability")?
                        .is_some();
                    projects.push(projection::project(project, &workspace, role, available));
                }
                Ok(Reply::ok(Payload::Projects(
                    self.page.page(projects, |p| p.id.0),
                )))
            }
            Action::SuggestProjectSlug(..) | Action::ProjectBySlug(..) => {
                Err(Error::OperationUnavailable)
            }
            Action::CreateProject(workspace_id, input) => {
                self.create_project(queries, *workspace_id, input)
            }
            Action::Project(id) => {
                let (project, role) = self.project_access(queries, *id)?;
                let workspace = queries
                    .organization(project.organization_id)
                    .context("workspace query")?
                    .ok_or(Error::NotFound)?;
                let available = self
                    .access(queries, project.id)
                    .context("project build availability")?
                    .is_some();
                Ok(Reply::ok(Payload::Project(projection::project(
                    project, &workspace, role, available,
                ))))
            }
            Action::UpdateProject(id, input) => {
                let mut project = self.project_admin(queries, *id)?;
                policy::version(input.version, project.version)?;
                if input.visibility == Visibility::Private
                    && project.visibility != Visibility::Private
                {
                    self.entitlements
                        .require_private_projects(queries, project.organization_id)?;
                }
                if input.require_approval {
                    return Err(Error::OperationUnavailable);
                }
                if let Some(enabled) = input.automatic_builds {
                    if enabled
                        && self
                            .access(queries, project.id)
                            .context("check Automatic builds availability")?
                            .is_none()
                    {
                        return Err(Error::BuildsUnavailable);
                    }
                    project.automatic_builds = enabled;
                }
                project.name = validation::name(&input.name).ok_or(Error::InvalidInput)?;
                project.slug = input.slug.clone();
                project.visibility = input.visibility;
                project.require_approval = input.require_approval;
                project.version += 1;
                match queries.save_project(&project) {
                    Ok(()) => {}
                    Err(StoreError::SlugTaken) => {
                        let suggestion = self.project_slug_recovery(
                            queries,
                            project.organization_id,
                            &project.slug,
                        )?;
                        return Err(Error::SlugTaken(suggestion.into_string()));
                    }
                    Err(StoreError::Internal(source)) => {
                        return Err(Error::internal_context(source, "save project query"));
                    }
                }
                let workspace = queries
                    .organization(project.organization_id)
                    .context("workspace query")?
                    .ok_or(Error::NotFound)?;
                let available = self
                    .access(queries, project.id)
                    .context("project build availability")?
                    .is_some();
                Ok(Reply::ok(Payload::Project(projection::project(
                    project,
                    &workspace,
                    Some(Role::Admin),
                    available,
                ))))
            }
            Action::DeleteProject(id, input) => {
                let project = self.project_admin(queries, *id)?;
                policy::version(input.version, project.version)?;
                if input.confirmation_name != project.name {
                    return Err(Error::InvalidInput);
                }
                queries
                    .delete_project(*id)
                    .context("delete project query")?;
                Ok(Reply::empty())
            }
            Action::Account(..)
            | Action::Workspaces
            | Action::SuggestWorkspaceSlug(_)
            | Action::CreateWorkspace(..)
            | Action::Workspace(..)
            | Action::WorkspaceBySlug(..)
            | Action::RenameWorkspace(..)
            | Action::DeleteWorkspace(..)
            | Action::Members(..)
            | Action::Invite(..)
            | Action::UpdateMember(..)
            | Action::RemoveMember(..)
            | Action::Accept(..)
            | Action::Grants(..)
            | Action::CreateGrant(..)
            | Action::UpdateGrant(..)
            | Action::RemoveGrant(..)
            | Action::Tokens(..)
            | Action::CreateToken(..)
            | Action::RevokeToken(..) => Err(Error::OperationUnavailable),
        }
    }
}
