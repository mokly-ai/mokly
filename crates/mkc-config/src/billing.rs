//! All-or-none Stripe billing configuration without secret-bearing diagnostics.

use std::sync::Arc;

use url::Url;

use crate::settings::{Environment, Error, Result};

/// Stripe deployment settings, deliberately without Debug.
pub struct BillingSettings {
    /// Restricted or secret API key for the selected account mode.
    pub secret_key: String,
    /// Signing secret for the registered webhook endpoint.
    pub webhook_secret: String,
    /// Exact Stripe API origin.
    pub api_origin: String,
}

/// Optional billing integration configuration boundary.
#[unimock::unimock(api = BillingConfigProviderMock)]
pub trait BillingConfigProvider: Send + Sync {
    /// Validate complete Stripe configuration or explicitly disable billing.
    fn load(&self, development: bool) -> Result<Option<BillingSettings>>;
}

/// Read Stripe settings through the shared injected environment seam.
pub struct BillingEnvironmentConfig {
    /// Environment collaborator.
    pub environment: Arc<dyn Environment>,
}

impl BillingConfigProvider for BillingEnvironmentConfig {
    fn load(&self, development: bool) -> Result<Option<BillingSettings>> {
        let mode = self.environment.get("MKC_BILLING");
        match mode.as_deref() {
            None | Some("") => return Ok(None),
            Some("stripe") => {}
            Some(_) => return Err(Error::Invalid("MKC_BILLING")),
        }
        let get = |key: &'static str| {
            self.environment
                .get(key)
                .filter(|value| !value.is_empty())
                .ok_or(Error::Invalid(key))
        };
        let secret_key = get("MKC_STRIPE_SECRET_KEY")?;
        if !(secret_key.starts_with("sk_") || secret_key.starts_with("rk_")) {
            return Err(Error::Invalid("MKC_STRIPE_SECRET_KEY"));
        }
        let webhook_secret = get("MKC_STRIPE_WEBHOOK_SECRET")?;
        if !webhook_secret.starts_with("whsec_") {
            return Err(Error::Invalid("MKC_STRIPE_WEBHOOK_SECRET"));
        }
        let api_origin = self
            .environment
            .get("MKC_STRIPE_API_ORIGIN")
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "https://api.stripe.com".to_owned());
        let api_origin = validate_api_origin(&api_origin, development)?;
        Ok(Some(BillingSettings {
            secret_key,
            webhook_secret,
            api_origin,
        }))
    }
}

fn validate_api_origin(value: &str, development: bool) -> Result<String> {
    let url = match Url::parse(value) {
        Ok(url) => url,
        Err(_) => return Err(Error::Invalid("MKC_STRIPE_API_ORIGIN")),
    };
    let exact_origin = url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
        && url.path() == "/"
        && url.query().is_none()
        && url.fragment().is_none();
    let development_loopback = development
        && url.scheme() == "http"
        && matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
        && url.port().is_some();
    if !exact_origin || !(url.scheme() == "https" || development_loopback) {
        return Err(Error::Invalid("MKC_STRIPE_API_ORIGIN"));
    }
    Ok(url.origin().ascii_serialization())
}

#[cfg(test)]
#[path = "_tests_/billing_tests.rs"]
mod tests;
