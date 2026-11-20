//! Shared transactional repository access and publication plan predicates.

use mkc_domain::ids::ProjectId;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Queries;

use crate::error::{ErrorResultExt, Result};

/// Installation access rechecked inside every build transaction.
pub struct BuildAccess {
    /// Current project and its settings.
    pub project: Project,
    /// Active bound repository.
    pub repository: Repository,
    /// Active installation owned by the project organization.
    pub installation: Installation,
}

/// Shared query policy implemented by the scheduler and worker.
pub trait BuildEligibility {
    /// Whether this deployment has the complete builds configuration.
    fn configured(&self) -> bool;

    /// Resolve current project access; absence means builds are unavailable.
    fn access(&self, queries: &mut dyn Queries, project: ProjectId) -> Result<Option<BuildAccess>> {
        if !self.configured() {
            return Ok(None);
        }
        let Some(project) = queries.project(project).context("read build project")? else {
            return Ok(None);
        };
        let Some(repository) = queries
            .github_project_repository(project.id)
            .context("read build repository")?
        else {
            return Ok(None);
        };
        if !repository.active {
            return Ok(None);
        }
        let Some(installation) = queries
            .github_installation(repository.installation_id)
            .context("read build installation")?
        else {
            return Ok(None);
        };
        if !installation.active
            || !installation.connected
            || installation.organization_id != Some(project.organization_id)
        {
            return Ok(None);
        }
        Ok(Some(BuildAccess {
            project,
            repository,
            installation,
        }))
    }

    /// Recheck the shared plan capability on the same transaction snapshot.
    fn publishing_allowed(&self, queries: &mut dyn Queries, project: &Project) -> Result<bool> {
        let organization = queries
            .organization(project.organization_id)
            .context("read build organization plan")?;
        Ok(organization
            .is_some_and(|organization| organization.plan.allows_publication(project.visibility)))
    }
}
