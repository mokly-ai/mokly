//! Project persistence data and query boundary.

use mkc_domain::ids::{OrganizationId, ProjectId};
use mkc_domain::slug::ProjectSlug;
use mkc_domain::values::Visibility;

use crate::error::Result;

/// Persisted project data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct Project {
    /// Stored id.
    pub id: ProjectId,
    /// Stored organization id.
    pub organization_id: OrganizationId,
    /// Stored name.
    pub name: String,
    /// Current readable address within the organization.
    pub slug: ProjectSlug,
    /// Stored repository.
    pub repository: String,
    /// Stored config path.
    pub config_path: String,
    /// Stored visibility.
    pub visibility: Visibility,
    /// Persisted approval policy, disabled until review is available.
    pub require_approval: bool,
    /// Automatic cloud builds setting; defaults to false in persistence.
    pub automatic_builds: bool,
    /// Stored version.
    pub version: i64,
}

/// Project resolved through a current or historical slug claim.
#[derive(Clone, Debug)]
pub struct ProjectLookup {
    /// Resolved project record.
    pub value: Project,
    /// Whether the requested slug differs from the current slug.
    pub retired: bool,
}

/// Queries for projects within the caller's transaction.
#[unimock::unimock(api = ProjectsMock)]
pub trait Projects {
    /// Execute the project query.
    fn project(&mut self, id: ProjectId) -> Result<Option<Project>>;
    /// Resolve a current or historical project slug within one organization.
    fn find_project_by_slug(
        &mut self,
        organization: OrganizationId,
        slug: &ProjectSlug,
    ) -> Result<Option<ProjectLookup>>;
    /// Whether any live project owns this scoped current or historical claim.
    fn project_slug_claimed(
        &mut self,
        organization: OrganizationId,
        slug: &ProjectSlug,
    ) -> Result<bool>;
    /// Execute the insert project query.
    fn insert_project(&mut self, value: &Project) -> Result<()>;
    /// Execute the save project query.
    fn save_project(&mut self, value: &Project) -> Result<()>;
    /// Execute the delete project query.
    fn delete_project(&mut self, id: ProjectId) -> Result<()>;
    /// Execute the projects query.
    fn projects(&mut self, organization: OrganizationId) -> Result<Vec<Project>>;
}
