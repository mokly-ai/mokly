//! Capability-gated preview sign-in configuration.

use mkc_domain::validation;
use mkc_domain::values::Plan;

use crate::settings::{EnvironmentConfig, Error, Result};

const SECRET_KEY: &str = "MKC_PREVIEW_SIGN_IN_SECRET";
const EMAIL_KEY: &str = "MKC_PREVIEW_SIGN_IN_EMAIL";
const PLAN_KEY: &str = "MKC_PREVIEW_SIGN_IN_PLAN";

/// Validated preview sign-in settings, intentionally without `Debug`.
pub struct PreviewSignInSettings {
    /// Namespace-scoped 256-bit lowercase-hex credential.
    pub secret: String,
    /// Normalized account email created or reused by the exchange.
    pub email: String,
    /// Initial plan for organizations created by this account.
    pub plan: Plan,
}

/// Optional preview sign-in configuration boundary.
pub(crate) trait PreviewSignInConfig {
    /// Validate the all-or-none settings under an explicit capability.
    fn preview_sign_in(&self, allowed: bool) -> Result<Option<PreviewSignInSettings>>;
}

impl PreviewSignInConfig for EnvironmentConfig {
    fn preview_sign_in(&self, allowed: bool) -> Result<Option<PreviewSignInSettings>> {
        let secret = self.environment.get(SECRET_KEY);
        let email = self.environment.get(EMAIL_KEY);
        let plan = self.environment.get(PLAN_KEY);
        if secret.is_none() && email.is_none() && plan.is_none() {
            return Ok(None);
        }
        if !allowed {
            let key = if plan.is_some() {
                PLAN_KEY
            } else if secret.is_some() {
                SECRET_KEY
            } else {
                EMAIL_KEY
            };
            return Err(Error::PreviewSignInDisallowed { key });
        }
        let secret = secret.ok_or(Error::PreviewSignInPartial {
            missing: SECRET_KEY,
        })?;
        let email = email.ok_or(Error::PreviewSignInPartial { missing: EMAIL_KEY })?;
        if secret.len() != 64
            || !secret
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
        {
            return Err(Error::PreviewSignInMalformed { key: SECRET_KEY });
        }
        let email =
            validation::email(&email).ok_or(Error::PreviewSignInMalformed { key: EMAIL_KEY })?;
        let plan = match plan.as_deref() {
            None | Some("free") => Plan::Free,
            Some("team") => Plan::Team,
            Some(_) => return Err(Error::PreviewSignInMalformed { key: PLAN_KEY }),
        };
        Ok(Some(PreviewSignInSettings {
            secret,
            email,
            plan,
        }))
    }
}

#[cfg(test)]
#[path = "_tests_/preview_tests.rs"]
mod tests;
