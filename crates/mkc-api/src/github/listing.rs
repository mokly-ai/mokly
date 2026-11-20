//! Workspace-scoped installation and repository product projections.

use mkc_domain::ids::{InstallationId, OrganizationId, UserId};
use mkc_store_interface::github_state;

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::service::GitHubService;
use super::views::{AccountKind, Installation, InstallationState, Repository};

impl GitHubService {
    pub(super) fn list_installations(
        &self,
        actor: UserId,
        workspace: Option<OrganizationId>,
    ) -> Result<Vec<Installation>> {
        let mut items = Vec::new();
        self.transact(true, &mut |queries| {
            items.clear();
            let workspaces = if let Some(workspace) = workspace {
                self.workspace_role(queries, actor, workspace)?;
                vec![workspace]
            } else {
                queries
                    .user_memberships(actor)
                    .context("list GitHub installation memberships")?
                    .into_iter()
                    .map(|membership| membership.organization_id)
                    .collect()
            };
            for workspace_id in workspaces {
                for installation in queries
                    .github_installations(workspace_id)
                    .context("list authorized GitHub installations")?
                {
                    if installation.connected {
                        items.push(Installation {
                            id: installation.id,
                            workspace_id,
                            account_kind: match installation.account_kind {
                                github_state::AccountKind::User => AccountKind::User,
                                github_state::AccountKind::Organization => {
                                    AccountKind::Organization
                                }
                            },
                            state: if installation.active {
                                InstallationState::Connected
                            } else {
                                InstallationState::Suspended
                            },
                            account: installation.account_name,
                            manage_url: installation.manage_url,
                        });
                    }
                }
            }
            items.sort_by_key(|item| item.id);
            Ok(())
        })?;
        Ok(items)
    }

    pub(super) fn list_repositories(
        &self,
        actor: UserId,
        id: InstallationId,
    ) -> Result<Vec<Repository>> {
        let mut items = Vec::new();
        self.transact(true, &mut |queries| {
            let installation = queries
                .github_installation(id)
                .context("read repository-list installation")?
                .ok_or(ApiError::NotFound)?;
            self.workspace_role(
                queries,
                actor,
                installation.organization_id.ok_or(ApiError::NotFound)?,
            )?;
            if !installation.connected || !installation.active {
                return Err(ApiError::NotFound);
            }
            items = queries
                .github_repositories(id)
                .context("list authorized installed repositories")?
                .into_iter()
                .filter(|repository| repository.active)
                .map(|repository| Repository {
                    id: repository.id,
                    installation_id: repository.installation_id,
                    full_name: repository.full_name,
                    default_branch: repository.default_branch,
                    private: repository.private,
                })
                .collect();
            Ok(())
        })?;
        Ok(items)
    }
}
