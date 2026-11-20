//! Session and workspace checks re-evaluated inside GitHub transactions.

use chrono::{DateTime, Utc};
use mkc_auth::service::Identity;
use mkc_auth::session_policy;
use mkc_domain::ids::{OrganizationId, UserId};
use mkc_domain::values::Role;
use mkc_store_interface::github_identity::OAuthFlow;
use mkc_store_interface::store::Queries;
use subtle::ConstantTimeEq;

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::service::GitHubService;

impl GitHubService {
    pub(super) fn workspace_role(
        &self,
        queries: &mut dyn Queries,
        actor: UserId,
        workspace: OrganizationId,
    ) -> Result<Role> {
        queries
            .members(workspace)
            .context("read GitHub organization membership")?
            .into_iter()
            .find(|member| member.user_id == Some(actor))
            .map(|member| member.role)
            .ok_or(ApiError::NotFound)
    }

    pub(super) fn workspace_admin(
        &self,
        queries: &mut dyn Queries,
        actor: UserId,
        workspace: OrganizationId,
    ) -> Result<()> {
        if !self.workspace_role(queries, actor, workspace)?.can_admin() {
            return Err(ApiError::PermissionDenied);
        }
        Ok(())
    }

    pub(super) fn session(
        &self,
        queries: &mut dyn Queries,
        identity: &Identity,
        now: DateTime<Utc>,
    ) -> Result<()> {
        let session = queries
            .session(&identity.session.token_hash)
            .context("recheck GitHub flow session")?
            .ok_or(ApiError::Unauthenticated)?;
        if session.user_id != identity.user.id {
            return Err(ApiError::Unauthenticated);
        }
        if session_policy::expired(&session, now) {
            return Err(ApiError::SessionExpired);
        }
        Ok(())
    }

    pub(super) fn binding(
        &self,
        queries: &mut dyn Queries,
        flow: &OAuthFlow,
        identity: Option<&Identity>,
        now: DateTime<Utc>,
    ) -> Result<()> {
        if let Some(user) = flow.user_id {
            let identity = identity.ok_or(ApiError::Unauthenticated)?;
            if identity.user.id != user
                || flow.session_hash.as_deref() != Some(&identity.session.token_hash)
            {
                return Err(ApiError::GITHUB_AUTH_INVALID);
            }
            self.session(queries, identity, now)?;
        }
        Ok(())
    }
}

pub(super) fn csrf(identity: &Identity, supplied: Option<&str>) -> Result<()> {
    if !supplied.is_some_and(|value| {
        bool::from(
            value
                .as_bytes()
                .ct_eq(identity.session.csrf_token.as_bytes()),
        )
    }) {
        return Err(ApiError::CsrfRejected);
    }
    Ok(())
}
