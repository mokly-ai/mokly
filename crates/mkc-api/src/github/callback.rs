//! One-use OAuth exchange followed by atomic identity and session issuance.

use mkc_auth::runtime::hash;
use mkc_auth::service::{Identity, LinkVerified, SessionIssued};
use mkc_auth::session_policy;
use mkc_domain::validation;
use mkc_github_interface::identity::OAuthCode;
use mkc_store_interface::github_state::FlowPurpose;

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::flow;
use super::identity::{VerifiedIdentityCommand, VerifiedUser};
use super::input::Callback;
use super::policy;
use super::reconciliation::InstallationUpdate;
use super::service::GitHubService;

impl GitHubService {
    pub(super) fn finish_callback(
        &self,
        identity: Option<&Identity>,
        input: Callback,
        previous: Option<&str>,
        csrf: Option<&str>,
    ) -> Result<LinkVerified> {
        if input.code.is_empty() || input.code.len() > 1024 {
            return Err(ApiError::GITHUB_AUTH_INVALID);
        }
        let started = self.runtime.now();
        let mut pending = None;
        self.transact(false, &mut |queries| {
            let mut state = queries
                .github_oauth_flow(&hash(&input.state))
                .context("read GitHub callback state")?
                .ok_or(ApiError::GITHUB_AUTH_INVALID)?;
            flow::validate(&state, &input.state, &input.code_verifier, started)?;
            self.binding(queries, &state, identity, started)?;
            if state.user_id.is_some() {
                policy::csrf(identity.ok_or(ApiError::Unauthenticated)?, csrf)?;
            }
            if state.purpose == FlowPurpose::Install && state.installation_id.is_none() {
                return Err(ApiError::GITHUB_AUTH_INVALID);
            }
            state.used_at = Some(started);
            queries
                .save_github_oauth_flow(&state)
                .context("consume GitHub OAuth state")?;
            pending = Some(state);
            Ok(())
        })?;
        let pending = pending.ok_or(ApiError::GITHUB_AUTH_INVALID)?;
        let token = self.identities.exchange(&OAuthCode {
            code: input.code,
            verifier: input.code_verifier,
        })?;
        let github = self.identities.user(&token)?;
        if github.id <= 0 || github.login.is_empty() {
            return Err(ApiError::GITHUB_AUTH_INVALID);
        }
        let emails = self.identities.emails(&token)?;
        let email = emails
            .into_iter()
            .find(|email| email.primary && email.verified)
            .and_then(|email| validation::email(&email.email))
            .ok_or(ApiError::GITHUB_EMAIL_UNVERIFIED)?;
        let installation = match pending.installation_id {
            Some(id) => Some(self.installation_proof(&token, &github, id)?),
            None => None,
        };
        let now = self.runtime.now();
        let credential = self
            .runtime
            .secret()
            .context("generate GitHub session credential")?;
        let csrf_token = self
            .runtime
            .secret()
            .context("generate GitHub session CSRF")?;
        let new_id = self.runtime.id().into();
        let mut output = None;
        self.transact(false, &mut |queries| {
            self.binding(queries, &pending, identity, now)?;
            let verified = VerifiedUser {
                github: &github,
                email: &email,
                actor: identity.filter(|_| pending.user_id.is_some()),
                new_id,
                now,
            };
            let command: &dyn VerifiedIdentityCommand = &verified;
            let user = command.resolve(queries)?;
            if let Some(installation) = &installation {
                let workspace_id = pending
                    .organization_id
                    .ok_or(ApiError::GITHUB_AUTH_INVALID)?;
                self.workspace_admin(queries, user.id, workspace_id)?;
                let update: &dyn InstallationUpdate = installation;
                update.apply(queries, Some(workspace_id))?;
            }
            if let Some(previous) = previous {
                queries
                    .delete_session(&hash(previous))
                    .context("revoke prior GitHub sign-in session")?;
            }
            let session = session_policy::new_session(user.id, &credential, &csrf_token, now);
            queries
                .insert_session(&session)
                .context("issue GitHub sign-in session")?;
            output = Some(Identity { user, session });
            Ok(())
        })?;
        Ok(LinkVerified {
            session: SessionIssued {
                identity: output.ok_or(ApiError::Unauthenticated)?,
                credential,
            },
            return_to: pending.return_to,
        })
    }
}
