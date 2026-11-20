//! Typed environment configuration with explicit production mail selection.

use std::env;
use std::net::SocketAddr;
use std::result;
use std::sync::Arc;

use internal_error::InternalError;
use thiserror::Error;
use url::Url;

use crate::billing::{BillingConfigProvider, BillingEnvironmentConfig, BillingSettings};
use crate::builds::{BuildConfigProvider, BuildEnvironmentConfig, BuildSettings};
use crate::capabilities::DeploymentEnvironment;
use crate::desktop::DesktopConfig;
use crate::github::{GitHubConfigProvider, GitHubEnvironmentConfig, GitHubSettings};
use crate::preview::{PreviewSignInConfig, PreviewSignInSettings};
use crate::proxy::{ProxyConfig, TrustedProxies};
use crate::publications::{PublicationConfig, PublicationSettings};

/// Configuration failures identify the key, never its secret value.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// A required key is absent or invalid.
    #[error("[mkc-config/settings] invalid configuration key: {0}")]
    Invalid(&'static str),
    /// An environment dependency failed.
    #[error("[mkc-config/settings] internal: {0:?}")]
    Internal(#[from] InternalError),
    /// Preview sign-in lacks a required identity setting.
    #[error("[mkc-config/settings] incomplete preview sign-in configuration; missing {missing}")]
    PreviewSignInPartial {
        /// Missing environment key.
        missing: &'static str,
    },
    /// A preview sign-in setting has an invalid value.
    #[error("[mkc-config/settings] malformed preview sign-in configuration key: {key}")]
    PreviewSignInMalformed {
        /// Invalid environment key.
        key: &'static str,
    },
    /// Preview sign-in was configured in an environment that forbids it.
    #[error("[mkc-config/settings] preview sign-in configuration key is not allowed: {key}")]
    PreviewSignInDisallowed {
        /// Configuration key forbidden by the environment capability.
        key: &'static str,
    },
}

/// Configuration result.
pub type Result<T> = result::Result<T, Error>;

/// Mail delivery configuration, intentionally without Debug.
pub enum Mail {
    /// Explicit development or preview link logging.
    Log,
    /// Postmark production transport.
    Postmark {
        /// Confirmed sender identity.
        from: String,
        /// Secret server token.
        token: String,
        /// Public site origin serving the email's brand images.
        site_origin: String,
    },
}

/// Validated process settings, intentionally without Debug.
pub struct Settings {
    /// Verified client-IP selection for authentication admission.
    pub trusted_proxies: TrustedProxies,
    /// Postgres connection URL.
    pub database_url: String,
    /// API listening address.
    pub bind: SocketAddr,
    /// Canonical application origin for CORS and links.
    pub app_origin: String,
    /// Admit the privileged desktop origin alongside the public application.
    pub desktop_client: bool,
    /// Exact public API origin that starts every upload plan's blob and completion URL.
    pub api_origin: String,
    /// Explicit delivery mode.
    pub mail: Mail,
    /// Optional fully configured GitHub App integration.
    pub github: Option<GitHubSettings>,
    /// Optional fully configured isolated builds.
    pub builds: Option<BuildSettings>,
    /// Optional fully configured Stripe billing integration.
    pub billing: Option<BillingSettings>,
    /// Optional capability-gated preview sign-in identity.
    pub preview_sign_in: Option<PreviewSignInSettings>,
    /// Separate catalogue origin, storage and private access configuration.
    pub publications: PublicationSettings,
}

/// Environment seam for configuration unit tests.
#[unimock::unimock(api = EnvironmentMock)]
pub trait Environment: Send + Sync {
    /// Read an environment variable; non-Unicode values remain present as empty input.
    fn get(&self, key: &str) -> Option<String>;
}

/// Process environment adapter used only at the composition root.
pub struct ProcessEnvironment;

impl Environment for ProcessEnvironment {
    fn get(&self, key: &str) -> Option<String> {
        match env::var(key) {
            Ok(value) => Some(value),
            Err(env::VarError::NotPresent) => None,
            Err(env::VarError::NotUnicode(_)) => Some(String::new()),
        }
    }
}

/// Typed configuration provider consumed at startup.
pub trait ConfigProvider {
    /// Read and validate process settings.
    fn load(&self) -> Result<Settings>;
}

/// Validates an injected environment source.
pub struct EnvironmentConfig {
    /// Environment collaborator.
    pub environment: Arc<dyn Environment>,
}

impl ConfigProvider for EnvironmentConfig {
    fn load(&self) -> Result<Settings> {
        let get = |key: &'static str| {
            self.environment
                .get(key)
                .filter(|s| !s.is_empty())
                .ok_or(Error::Invalid(key))
        };
        let capabilities =
            DeploymentEnvironment::parse(self.environment.get("MKC_ENV").as_deref())?
                .capabilities();
        let database_url = get("MKC_DATABASE_URL")?;
        if !database_url.starts_with("postgres://") && !database_url.starts_with("postgresql://") {
            return Err(Error::Invalid("MKC_DATABASE_URL"));
        }
        let bind = match self
            .environment
            .get("MKC_BIND")
            .unwrap_or_else(|| "127.0.0.1:8080".to_owned())
            .parse()
        {
            Ok(bind) => bind,
            Err(_) => return Err(Error::Invalid("MKC_BIND")),
        };
        let app_origin = validate_origin(
            &get("MKC_APP_ORIGIN")?,
            capabilities.http_loopback,
            "MKC_APP_ORIGIN",
        )?;
        let api_origin = validate_origin(
            &get("MKC_API_ORIGIN")?,
            capabilities.http_loopback,
            "MKC_API_ORIGIN",
        )?;
        let mail = match get("MKC_MAILER")?.as_str() {
            "log" if capabilities.log_mail => Mail::Log,
            "postmark" => Mail::Postmark {
                from: get("POSTMARK_FROM")?,
                token: get("POSTMARK_SERVER_TOKEN")?,
                site_origin: validate_origin(
                    &get("MKC_SITE_ORIGIN")?,
                    capabilities.http_loopback,
                    "MKC_SITE_ORIGIN",
                )?,
            },
            _ => return Err(Error::Invalid("MKC_MAILER")),
        };
        let publications = self.publications(capabilities.http_loopback, &app_origin)?;
        let github = GitHubEnvironmentConfig {
            environment: self.environment.clone(),
        }
        .load(capabilities.http_loopback)?;
        let builds = BuildEnvironmentConfig {
            environment: self.environment.clone(),
        }
        .load(github.is_some())?;
        Ok(Settings {
            trusted_proxies: self.proxies()?,
            database_url,
            bind,
            app_origin,
            desktop_client: self.desktop_client()?,
            api_origin,
            mail,
            github,
            builds,
            billing: BillingEnvironmentConfig {
                environment: self.environment.clone(),
            }
            .load(capabilities.http_loopback)?,
            preview_sign_in: self.preview_sign_in(capabilities.preview_sign_in)?,
            publications,
        })
    }
}

/// Validate an exact origin, allowing HTTP only on loopback when the deployment permits it.
pub fn validate_origin(value: &str, http_loopback: bool, key: &'static str) -> Result<String> {
    let url = match Url::parse(value) {
        Ok(url) => url,
        Err(_) => return Err(Error::Invalid(key)),
    };
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if url.host_str().is_none()
        || !(url.scheme() == "https" || http_loopback && local && url.scheme() == "http")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(Error::Invalid(key));
    }
    Ok(url.origin().ascii_serialization())
}

#[cfg(test)]
#[path = "_tests_/settings_tests.rs"]
mod settings_tests;
