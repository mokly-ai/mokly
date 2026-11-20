//! Transactional authorization shared by platform commands.

use mkc_domain::ids::{OrganizationId, ProjectId};
use mkc_domain::values::Role;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Queries;

use super::error::{Error, ErrorResultExt, Result};
use super::execution::Execution;
use super::project_access::{ProjectAccess, ProjectReader};

impl Execution<'_> {
    pub(super) fn workspace_role(
        &self,
        queries: &mut dyn Queries,
        workspace_id: OrganizationId,
    ) -> Result<Role> {
        let actor = self.actor()?;
        queries
            .members(workspace_id)
            .context("members query")?
            .into_iter()
            .find(|m| m.user_id == Some(actor))
            .map(|m| m.role)
            .ok_or(Error::NotFound)
    }

    pub(super) fn workspace_admin(
        &self,
        queries: &mut dyn Queries,
        workspace_id: OrganizationId,
    ) -> Result<Role> {
        let role = self.workspace_role(queries, workspace_id)?;
        if !role.can_admin() {
            return Err(Error::Forbidden);
        }
        Ok(role)
    }

    pub(super) fn project_access(
        &self,
        queries: &mut dyn Queries,
        id: ProjectId,
    ) -> Result<(Project, Option<Role>)> {
        let reader: &dyn ProjectAccess = &ProjectReader { actor: self.actor };
        reader.read(queries, id)
    }

    pub(super) fn project_admin(
        &self,
        queries: &mut dyn Queries,
        id: ProjectId,
    ) -> Result<Project> {
        let (project, role) = self.project_access(queries, id)?;
        if !role.is_some_and(Role::can_admin) {
            return Err(Error::Forbidden);
        }
        Ok(project)
    }
}

pub(super) fn version(supplied: i64, current: i64) -> Result<()> {
    if supplied < 1 {
        return Err(Error::InvalidInput);
    }
    if supplied != current {
        return Err(Error::VersionConflict(current));
    }
    Ok(())
}
