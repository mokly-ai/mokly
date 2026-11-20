//! Shared non-disclosing project visibility for platform and viewer reads.

use mkc_domain::ids::{ProjectId, UserId};
use mkc_domain::values::{Role, Visibility};
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Queries;

use super::error::{Error, ErrorResultExt, Result};

#[unimock::unimock(api = [ProjectAccessMock])]
pub(crate) trait ProjectAccess {
    fn read(&self, queries: &mut dyn Queries, id: ProjectId) -> Result<(Project, Option<Role>)>;
}

pub(crate) struct ProjectReader {
    pub(crate) actor: Option<UserId>,
}

impl ProjectAccess for ProjectReader {
    fn read(&self, queries: &mut dyn Queries, id: ProjectId) -> Result<(Project, Option<Role>)> {
        let project = queries
            .project(id)
            .context("project query")?
            .ok_or(Error::NotFound)?;
        let mut role = None;
        if let Some(actor) = self.actor {
            role = queries
                .members(project.organization_id)
                .context("members query")?
                .into_iter()
                .find(|member| member.user_id == Some(actor))
                .map(|member| member.role.project_role());
            let direct = queries
                .grants(id)
                .context("grants query")?
                .into_iter()
                .find(|grant| grant.user_id == actor)
                .map(|grant| grant.role);
            role = role.max(direct);
        }
        if role.is_none() && project.visibility == Visibility::Private {
            return Err(Error::NotFound);
        }
        Ok((project, role))
    }
}
