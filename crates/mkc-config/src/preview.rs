//! Capability-gated preview sign-in configuration.

use mkc_auth::preview_verifier::PreviewVerifier;
use mkc_domain::validation;
use mkc_domain::values::Plan;

use crate::settings::{EnvironmentConfig, Error, Result};

const VERIFIER_KEY: &str = "MKC_PREVIEW_SIGN_IN_VERIFIER";
const EMAIL_KEY: &str = "MKC_PREVIEW_SIGN_IN_EMAIL";
const PLAN_KEY: &str = "MKC_PREVIEW_SIGN_IN_PLAN";

/// Validated preview sign-in settings, intentionally without `Debug`.
pub struct PreviewSignInSettings {
    /// Optional verifier for the shared account's password.
    pub verifier: Option<PreviewVerifier>,
    /// Normalized account email created or reused by the exchange.
    pub email: String,
    /// Initial plan for organizations created by this account.
    pub plan: Plan,
}

/// Optional preview sign-in configuration boundary.
pub(crate) trait PreviewSignInConfig {
    /// Validate the account and its optional settings under an explicit capability.
    fn preview_sign_in(&self, allowed: bool) -> Result<Option<PreviewSignInSettings>>;
}

impl PreviewSignInConfig for EnvironmentConfig {
    fn preview_sign_in(&self, allowed: bool) -> Result<Option<PreviewSignInSettings>> {
        let verifier = self.environment.get(VERIFIER_KEY);
        let email = self.environment.get(EMAIL_KEY);
        let plan = self.environment.get(PLAN_KEY);
        if verifier.is_none() && email.is_none() && plan.is_none() {
            return Ok(None);
        }
        if !allowed {
            let key = if plan.is_some() {
                PLAN_KEY
            } else if verifier.is_some() {
                VERIFIER_KEY
            } else {
                EMAIL_KEY
            };
            return Err(Error::PreviewSignInDisallowed { key });
        }
        let email = email.ok_or(Error::PreviewSignInPartial { missing: EMAIL_KEY })?;
        let email =
            validation::email(&email).ok_or(Error::PreviewSignInMalformed { key: EMAIL_KEY })?;
        let verifier = match verifier {
            Some(value) => Some(
                PreviewVerifier::parse(&value)
                    .ok_or(Error::PreviewSignInMalformed { key: VERIFIER_KEY })?,
            ),
            None => None,
        };
        let plan = match plan.as_deref() {
            None | Some("free") => Plan::Free,
            Some("team") => Plan::Team,
            Some(_) => return Err(Error::PreviewSignInMalformed { key: PLAN_KEY }),
        };
        Ok(Some(PreviewSignInSettings {
            verifier,
            email,
            plan,
        }))
    }
}

#[cfg(test)]
#[path = "_tests_/preview_tests.rs"]
mod tests;
