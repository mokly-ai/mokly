//! Live account-administration proof and local installation disconnection.

use mkc_domain::ids::{InstallationId, UserId};
use mkc_github_interface::credentials::Secret;
use mkc_github_interface::identity::{MembershipRole, MembershipState};
use mkc_github_interface::repositories::{Account, AccountKind};

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::reconciliation::Snapshot;
use super::service::GitHubService;

impl GitHubService {
    pub(super) fn installation_proof(
        &self,
        token: &Secret,
        user: &Account,
        installation: i64,
    ) -> Result<Snapshot> {
        if !self
            .identities
            .installations(token)?
            .iter()
            .any(|value| value.id == installation && value.app_id == self.navigation.app_id)
        {
            return Err(ApiError::PermissionDenied);
        }
        let observed_at = self.runtime.now();
        let current = self.repositories.installation(installation)?;
        if current.id != installation
            || current.app_id != self.navigation.app_id
            || current.suspended_at.is_some()
        {
            return Err(ApiError::PermissionDenied);
        }
        match current.account.kind {
            AccountKind::User if current.account.id == user.id => {}
            AccountKind::Organization => {
                let membership = self.identities.membership(token, &current.account.login)?;
                if membership.role != MembershipRole::Admin
                    || membership.state != MembershipState::Active
                {
                    return Err(ApiError::PermissionDenied);
                }
            }
            AccountKind::User | AccountKind::Bot | AccountKind::Enterprise => {
                return Err(ApiError::PermissionDenied);
            }
        }
        self.tokens.invalidate(installation)?;
        let repositories = self
            .repositories
            .repositories(installation)?
            .into_iter()
            .map(|repository| (self.runtime.id().into(), repository))
            .collect();
        Ok(Snapshot::Available {
            id: self.runtime.id().into(),
            installation: current,
            repositories,
            observed_at,
        })
    }

    pub(super) fn remove_installation(&self, actor: UserId, id: InstallationId) -> Result<()> {
        let mut provider = None;
        let now = self.runtime.now();
        self.transact(false, &mut |queries| {
            let mut installation = queries
                .github_installation(id)
                .context("read disconnecting GitHub installation")?
                .ok_or(ApiError::NotFound)?;
            let workspace_id = installation.organization_id.ok_or(ApiError::NotFound)?;
            self.workspace_admin(queries, actor, workspace_id)?;
            provider = Some(installation.github_id);
            installation.connected = false;
            installation.updated_at = now;
            installation.organization_id = None;
            queries
                .save_github_installation(&installation)
                .context("disconnect GitHub installation")?;
            Ok(())
        })?;
        if let Some(provider) = provider {
            self.tokens.invalidate(provider)?;
        }
        Ok(())
    }
}
