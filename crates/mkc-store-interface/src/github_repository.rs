//! Installed repository and project association queries.

use mkc_domain::ids::{InstallationId, ProjectId, RepositoryId};

use crate::error::Result;
use crate::project::Project;

/// Persisted repository selection; inactive records preserve project history.
#[derive(Clone, Debug)]
pub struct Repository {
    /// Opaque cloud repository ID.
    pub id: RepositoryId,
    /// Installation granting provider access.
    pub installation_id: InstallationId,
    /// Stable GitHub repository ID.
    pub github_id: i64,
    /// Canonical owner/repository name.
    pub full_name: String,
    /// Provider default branch.
    pub default_branch: String,
    /// Provider repository visibility.
    pub private: bool,
    /// Repository is currently selected for the installation.
    pub active: bool,
}

/// Repository and project-link queries within a transaction.
#[unimock::unimock(api = GitHubRepositoriesMock)]
pub trait GitHubRepositories {
    /// Read by cloud ID.
    fn github_repository(&mut self, id: RepositoryId) -> Result<Option<Repository>>;
    /// List all records, including inactive rows, for reconciliation.
    fn github_repositories(&mut self, installation: InstallationId) -> Result<Vec<Repository>>;
    /// Insert or update canonical metadata.
    fn save_github_repository(&mut self, value: &Repository) -> Result<()>;
    /// Bind a project to a validated installed repository.
    fn link_github_project(&mut self, project: ProjectId, repository: RepositoryId) -> Result<()>;
    /// Read the projects bound to a repository, in project-ID order.
    fn github_repository_projects(&mut self, repository: RepositoryId) -> Result<Vec<Project>>;
    /// Find the installed repository associated with a project.
    fn github_project_repository(&mut self, project: ProjectId) -> Result<Option<Repository>>;
}
