//! Browser-held PKCE inputs and persisted one-use flow admission.

use chrono::Duration;
use mkc_auth::runtime::hash;
use mkc_auth::service::Identity;
use mkc_domain::ids::OrganizationId;
use mkc_domain::validation;
use mkc_github::security::pkce_challenge;
use mkc_store_interface::github_identity::OAuthFlow;
use mkc_store_interface::github_state::FlowPurpose;
use mkc_store_interface::rate_limit::RateLimit;
use thiserror::Error;
use url::Url;

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::github_providers::github_callback_uri;

use super::input::InstallationCallback;
use super::service::GitHubService;
use super::views::Connection;

/// A generated state must never collide with any persisted flow.
#[derive(Debug, Error)]
enum EntropyFailure {
    #[error("[mkc-api/github/flow] generated OAuth state collided")]
    StateCollision,
}

impl GitHubService {
    pub(super) fn start_flow(
        &self,
        identity: Option<&Identity>,
        purpose: FlowPurpose,
        workspace: Option<OrganizationId>,
        installation_id: Option<i64>,
        return_to: Option<&str>,
        peer: &str,
    ) -> Result<Connection> {
        if installation_id.is_some_and(|id| id <= 0) {
            return Err(ApiError::ValidationFailed);
        }
        let state = self
            .runtime
            .secret()
            .context("generate GitHub OAuth state")?;
        let verifier = self
            .runtime
            .secret()
            .context("generate GitHub PKCE verifier")?;
        let now = self.runtime.now();
        let flow = OAuthFlow {
            state_hash: hash(&state),
            verifier_hash: hash(&verifier),
            purpose,
            user_id: identity.map(|identity| identity.user.id),
            session_hash: identity.map(|identity| identity.session.token_hash.clone()),
            organization_id: workspace,
            installation_id,
            return_to: validation::return_to(return_to),
            expires_at: now + Duration::minutes(10),
            used_at: None,
        };
        self.transact(false, &mut |queries| {
            if purpose != FlowPurpose::SignIn {
                self.session(queries, identity.ok_or(ApiError::Unauthenticated)?, now)?;
            }
            if let Some(workspace_id) = workspace {
                self.workspace_admin(
                    queries,
                    identity.ok_or(ApiError::Unauthenticated)?.user.id,
                    workspace_id,
                )?;
            }
            let key = hash(&format!("github:{peer}"));
            let old = queries
                .rate_limit(&key)
                .context("read GitHub flow admission")?;
            let current = old.as_ref().filter(|record| now < record.resets_at);
            if let Some(record) = current
                && record.count >= 20
            {
                return Err(ApiError::RateLimited(
                    (record.resets_at - now).num_seconds().max(1),
                ));
            }
            let rate = RateLimit {
                key,
                count: current.map_or(1, |record| record.count + 1),
                resets_at: current.map_or(now + Duration::seconds(60), |record| record.resets_at),
            };
            if old.is_some() {
                queries
                    .save_rate_limit(&rate)
                    .context("update GitHub flow admission")?;
            } else {
                queries
                    .insert_rate_limit(&rate)
                    .context("insert GitHub flow admission")?;
            }
            if queries
                .github_oauth_flow(&flow.state_hash)
                .context("check GitHub state uniqueness")?
                .is_some()
            {
                return Err(ApiError::internal(EntropyFailure::StateCollision));
            }
            queries
                .save_github_oauth_flow(&flow)
                .context("persist GitHub OAuth flow")?;
            Ok(())
        })?;
        self.connection(
            purpose == FlowPurpose::Install && installation_id.is_none(),
            state,
            verifier,
        )
    }

    pub(super) fn prepare_installation(
        &self,
        identity: &Identity,
        input: InstallationCallback,
    ) -> Result<Connection> {
        if input.installation_id <= 0 {
            return Err(ApiError::ValidationFailed);
        }
        let now = self.runtime.now();
        self.transact(false, &mut |queries| {
            let mut flow = queries
                .github_oauth_flow(&hash(&input.state))
                .context("read installation setup state")?
                .ok_or(ApiError::GITHUB_AUTH_INVALID)?;
            validate(&flow, &input.state, &input.code_verifier, now)?;
            if flow.purpose != FlowPurpose::Install {
                return Err(ApiError::GITHUB_AUTH_INVALID);
            }
            self.binding(queries, &flow, Some(identity), now)?;
            self.workspace_admin(
                queries,
                identity.user.id,
                flow.organization_id.ok_or(ApiError::GITHUB_AUTH_INVALID)?,
            )?;
            flow.installation_id = Some(input.installation_id);
            queries
                .save_github_oauth_flow(&flow)
                .context("record installation candidate")?;
            Ok(())
        })?;
        self.connection(false, input.state, input.code_verifier)
    }

    fn connection(
        &self,
        install: bool,
        state: String,
        code_verifier: String,
    ) -> Result<Connection> {
        let origin = &self.navigation.web_origin;
        let mut url = if install {
            Url::parse(&format!(
                "{origin}/apps/{}/installations/new",
                self.navigation.app_slug
            ))
        } else {
            Url::parse(&format!("{origin}/login/oauth/authorize"))
        }
        .context("build GitHub authorization URL")?;
        url.query_pairs_mut().append_pair("state", &state);
        if !install {
            url.query_pairs_mut()
                .append_pair("client_id", &self.navigation.client_id)
                .append_pair(
                    "redirect_uri",
                    &github_callback_uri(&self.navigation.app_origin),
                )
                .append_pair("code_challenge_method", "S256")
                .append_pair("code_challenge", &pkce_challenge(&code_verifier));
        }
        Ok(Connection {
            authorize_url: url.to_string(),
            state,
            code_verifier,
        })
    }
}

pub(super) fn validate(
    flow: &OAuthFlow,
    state: &str,
    verifier: &str,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<()> {
    if !credential(state)
        || !credential(verifier)
        || flow.state_hash != hash(state)
        || flow.verifier_hash != hash(verifier)
        || now >= flow.expires_at
        || flow.used_at.is_some()
    {
        return Err(ApiError::GITHUB_AUTH_INVALID);
    }
    Ok(())
}

fn credential(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}
