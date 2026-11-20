//! Prepared provider snapshots applied atomically without external effects.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{InstallationId, OrganizationId, RepositoryId};
use mkc_github_interface::repositories;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::store::Queries;

use crate::error::{ApiError, ApiErrorResultExt, Result};

pub(crate) enum Snapshot {
    Available {
        id: InstallationId,
        installation: repositories::Installation,
        repositories: Vec<(RepositoryId, repositories::Repository)>,
        observed_at: DateTime<Utc>,
    },
    Removed {
        github_id: i64,
        observed_at: DateTime<Utc>,
    },
}

pub(crate) trait InstallationUpdate {
    fn apply(&self, queries: &mut dyn Queries, bind: Option<OrganizationId>) -> Result<()>;
}

impl InstallationUpdate for Snapshot {
    fn apply(&self, queries: &mut dyn Queries, bind: Option<OrganizationId>) -> Result<()> {
        match self {
            Self::Removed {
                github_id,
                observed_at,
            } => {
                if let Some(mut record) = queries
                    .github_installation_by_provider(*github_id)
                    .context("find removed GitHub installation")?
                {
                    if record.updated_at > *observed_at {
                        return Ok(());
                    }
                    record.active = false;
                    record.connected = false;
                    record.organization_id = None;
                    record.updated_at = *observed_at;
                    queries
                        .save_github_installation(&record)
                        .context("disable uninstalled GitHub installation")?;
                    for mut repository in queries
                        .github_repositories(record.id)
                        .context("read uninstalled repositories")?
                    {
                        repository.active = false;
                        queries
                            .save_github_repository(&repository)
                            .context("disable uninstalled repository")?;
                    }
                }
                Ok(())
            }
            Self::Available {
                id,
                installation,
                repositories,
                observed_at,
            } => {
                let existing = queries
                    .github_installation_by_provider(installation.id)
                    .context("read reconciled GitHub installation")?;
                if existing
                    .as_ref()
                    .is_some_and(|record| record.updated_at > *observed_at)
                {
                    return if bind.is_some() {
                        Err(ApiError::Unavailable)
                    } else {
                        Ok(())
                    };
                }
                if let Some(workspace) = bind
                    && existing.as_ref().is_some_and(|record| {
                        record
                            .organization_id
                            .is_some_and(|bound| bound != workspace)
                    })
                {
                    return Err(ApiError::GITHUB_INSTALLATION_CONFLICT);
                }
                let workspace_id =
                    bind.or_else(|| existing.as_ref().and_then(|record| record.organization_id));
                let record = Installation {
                    id: existing.as_ref().map_or(*id, |record| record.id),
                    github_id: installation.id,
                    app_id: installation.app_id,
                    organization_id: workspace_id,
                    account_id: installation.account.id,
                    account_name: installation.account.login.clone(),
                    account_kind: match installation.account.kind {
                        repositories::AccountKind::User => AccountKind::User,
                        repositories::AccountKind::Organization => AccountKind::Organization,
                        repositories::AccountKind::Bot | repositories::AccountKind::Enterprise => {
                            return Err(ApiError::PermissionDenied);
                        }
                    },
                    manage_url: installation.html_url.clone(),
                    active: installation.suspended_at.is_none(),
                    connected: bind.is_some()
                        || existing.as_ref().is_some_and(|record| record.connected),
                    updated_at: *observed_at,
                };
                queries
                    .save_github_installation(&record)
                    .context("save reconciled GitHub installation")?;
                let old = queries
                    .github_repositories(record.id)
                    .context("read installed repository selection")?;
                for mut repository in old
                    .iter()
                    .filter(|repository| {
                        !repositories
                            .iter()
                            .any(|(_, value)| value.id == repository.github_id)
                    })
                    .cloned()
                {
                    repository.active = false;
                    queries
                        .save_github_repository(&repository)
                        .context("deactivate removed repository selection")?;
                }
                for (id, value) in repositories {
                    let previous = old.iter().find(|record| record.github_id == value.id);
                    queries
                        .save_github_repository(&Repository {
                            id: previous.map_or(*id, |record| record.id),
                            installation_id: record.id,
                            github_id: value.id,
                            full_name: value.full_name.clone(),
                            default_branch: value.default_branch.clone(),
                            private: value.private,
                            active: record.active,
                        })
                        .context("save selected GitHub repository")?;
                }
                Ok(())
            }
        }
    }
}
