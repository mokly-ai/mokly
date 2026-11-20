//! All-or-none GitHub App configuration without secret-bearing diagnostics.

use std::sync::Arc;

use crate::settings::{Environment, Error, Result, validate_origin};

/// GitHub's own REST origin, used unless a development deployment overrides it.
const API_ORIGIN: &str = "https://api.github.com";
/// GitHub's own web origin, used unless a development deployment overrides it.
const WEB_ORIGIN: &str = "https://github.com";
const API_ORIGIN_KEY: &str = "MKC_GITHUB_API_ORIGIN";
const WEB_ORIGIN_KEY: &str = "MKC_GITHUB_WEB_ORIGIN";

/// GitHub App deployment settings, deliberately without Debug.
pub struct GitHubSettings {
    /// GitHub's numeric App ID.
    pub app_id: i64,
    /// Registered App client ID.
    pub client_id: String,
    /// OAuth client secret.
    pub client_secret: String,
    /// GitHub App slug used by installation URLs.
    pub app_slug: String,
    /// RSA private key in PEM format.
    pub private_key: String,
    /// Independent webhook HMAC secret.
    pub webhook_secret: String,
    /// REST transport origin; GitHub's own unless a development deployment overrides it.
    pub api_origin: String,
    /// Authorization and installation origin; GitHub's own unless overridden.
    pub web_origin: String,
}

/// Optional integration configuration boundary.
pub trait GitHubConfigProvider {
    /// Validate complete configuration or explicitly disable the integration.
    ///
    /// `http_loopback` is the deployment capability that admits the recorded
    /// GitHub origins; without it either origin key refuses startup.
    fn load(&self, http_loopback: bool) -> Result<Option<GitHubSettings>>;
}

/// Read GitHub settings through the same injected environment seam.
pub struct GitHubEnvironmentConfig {
    /// Environment collaborator.
    pub environment: Arc<dyn Environment>,
}

impl GitHubEnvironmentConfig {
    /// Resolve the transport origins, defaulting to GitHub's own.
    fn origins(&self, http_loopback: bool) -> Result<(String, String)> {
        let read = |key: &str| self.environment.get(key).filter(|value| !value.is_empty());
        let api = read(API_ORIGIN_KEY);
        let web = read(WEB_ORIGIN_KEY);
        if !http_loopback {
            if api.is_some() {
                return Err(Error::Invalid(API_ORIGIN_KEY));
            }
            if web.is_some() {
                return Err(Error::Invalid(WEB_ORIGIN_KEY));
            }
        }
        match (api, web) {
            (None, None) => Ok((API_ORIGIN.to_owned(), WEB_ORIGIN.to_owned())),
            (Some(_), None) => Err(Error::Invalid(WEB_ORIGIN_KEY)),
            (None, Some(_)) => Err(Error::Invalid(API_ORIGIN_KEY)),
            (Some(api), Some(web)) => Ok((
                validate_origin(&api, http_loopback, API_ORIGIN_KEY)?,
                validate_origin(&web, http_loopback, WEB_ORIGIN_KEY)?,
            )),
        }
    }
}

impl GitHubConfigProvider for GitHubEnvironmentConfig {
    fn load(&self, http_loopback: bool) -> Result<Option<GitHubSettings>> {
        let (api_origin, web_origin) = self.origins(http_loopback)?;
        let keys = [
            "MKC_GITHUB_APP_ID",
            "MKC_GITHUB_CLIENT_ID",
            "MKC_GITHUB_CLIENT_SECRET",
            "MKC_GITHUB_APP_SLUG",
            "MKC_GITHUB_PRIVATE_KEY",
            "MKC_GITHUB_WEBHOOK_SECRET",
        ];
        let values: Vec<_> = keys.iter().map(|key| self.environment.get(key)).collect();
        if values.iter().all(Option::is_none) {
            return Ok(None);
        }
        let get = |index: usize| {
            values[index]
                .clone()
                .filter(|value| !value.is_empty())
                .ok_or(Error::Invalid(keys[index]))
        };
        let app_id = match get(0)?.parse::<i64>() {
            Ok(value) if value > 0 => value,
            _ => return Err(Error::Invalid(keys[0])),
        };
        let app_slug = get(3)?;
        if !app_slug
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err(Error::Invalid(keys[3]));
        }
        let webhook_secret = get(5)?;
        if webhook_secret.len() < 32 {
            return Err(Error::Invalid(keys[5]));
        }
        Ok(Some(GitHubSettings {
            app_id,
            client_id: get(1)?,
            client_secret: get(2)?,
            app_slug,
            private_key: get(4)?,
            webhook_secret,
            api_origin,
            web_origin,
        }))
    }
}

#[cfg(test)]
#[path = "_tests_/github_tests.rs"]
mod github_tests;
