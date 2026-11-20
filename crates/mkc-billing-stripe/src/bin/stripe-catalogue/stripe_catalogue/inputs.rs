//! Ambient command inputs and their fail-closed validation.

use std::env;

use url::Url;

use super::args::CatalogueEnvironment;
use super::report::ErrorLine;

const DEFAULT_STRIPE_ORIGIN: &str = "https://api.stripe.com";

/// Ambient variables required by catalogue reconciliation.
#[cfg_attr(
    test,
    unimock::unimock(api = [CatalogueKeyMock, ApiOriginMock])
)]
pub(crate) trait CatalogueVariables: Send + Sync {
    /// Read the catalogue credential without logging it.
    fn catalogue_key(&self) -> Option<String>;
    /// Read the optional Stripe API origin override.
    fn api_origin(&self) -> Option<String>;
}

/// Process-environment implementation used by the command composition root.
pub(crate) struct ProcessCatalogueVariables;

impl CatalogueVariables for ProcessCatalogueVariables {
    fn catalogue_key(&self) -> Option<String> {
        env::var("MKC_STRIPE_CATALOGUE_KEY").ok()
    }

    fn api_origin(&self) -> Option<String> {
        env::var("MKC_STRIPE_API_ORIGIN").ok()
    }
}

/// Validated secret and transport origin.
pub(crate) struct SyncInputs {
    pub(crate) key: String,
    pub(crate) api_origin: String,
}

/// Read and validate every ambient input before transport construction.
pub(crate) fn read_sync_inputs(
    variables: &dyn CatalogueVariables,
    environment: CatalogueEnvironment,
) -> Result<SyncInputs, ErrorLine> {
    let key = match variables.catalogue_key() {
        Some(key) if !key.is_empty() => key,
        Some(_) | None => return Err(ErrorLine::MissingKey),
    };
    if !is_restricted_key(&key) {
        return Err(ErrorLine::WrongKeyKind);
    }
    if !key_matches_environment(&key, environment) {
        return Err(ErrorLine::WrongKeyMode { environment });
    }

    let api_origin = variables
        .api_origin()
        .unwrap_or_else(|| DEFAULT_STRIPE_ORIGIN.to_owned());
    if !valid_origin(&api_origin) {
        return Err(ErrorLine::InvalidOrigin);
    }
    Ok(SyncInputs { key, api_origin })
}

fn is_restricted_key(key: &str) -> bool {
    key.starts_with("rk_test_") || key.starts_with("rk_live_")
}

fn key_matches_environment(key: &str, environment: CatalogueEnvironment) -> bool {
    match environment {
        CatalogueEnvironment::MainPreview => key.starts_with("rk_test_"),
        CatalogueEnvironment::Production => key.starts_with("rk_live_"),
    }
}

fn valid_origin(origin: &str) -> bool {
    let url = match Url::parse(origin) {
        Ok(url) => url,
        Err(_) => return false,
    };
    let common = url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
        && url.path() == "/"
        && url.query().is_none()
        && url.fragment().is_none()
        && exact_origin_syntax(origin, url.scheme());
    if !common {
        return false;
    }
    match url.scheme() {
        "https" => true,
        "http" => {
            matches!(url.host_str(), Some("127.0.0.1" | "localhost")) && has_explicit_port(origin)
        }
        _ => false,
    }
}

fn exact_origin_syntax(origin: &str, scheme: &str) -> bool {
    origin
        .strip_prefix(&format!("{scheme}://"))
        .map(|remainder| remainder.strip_suffix('/').unwrap_or(remainder))
        .is_some_and(|authority| {
            !authority.is_empty() && !authority.contains('/') && !authority.ends_with(':')
        })
}

fn has_explicit_port(origin: &str) -> bool {
    let authority = origin
        .strip_prefix("http://")
        .and_then(|value| value.strip_suffix('/').or(Some(value)));
    authority
        .and_then(|value| value.rsplit_once(':'))
        .is_some_and(|(_, port)| !port.is_empty() && port.bytes().all(|byte| byte.is_ascii_digit()))
}
