//! Secret-bearing credentials and injectable authentication dependencies.

use std::fmt;
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::error::Result;

/// Credential with redacted diagnostics and no serialization implementation.
#[derive(Clone, Deserialize)]
#[serde(transparent)]
pub struct Secret(String);

impl Secret {
    /// Wrap a credential obtained from secure configuration or a provider.
    pub fn new(value: String) -> Self {
        Self(value)
    }

    /// Borrow the credential only for its intended authentication boundary.
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Secret([redacted])")
    }
}

/// GitHub installation credential with its authoritative expiry.
#[derive(Clone, Debug, Deserialize)]
pub struct InstallationToken {
    /// Bearer credential, excluded from product responses.
    pub token: Secret,
    /// Provider expiry in UTC.
    pub expires_at: DateTime<Utc>,
}

/// Clock shared by token and retry policy.
#[unimock::unimock(api = ClockMock)]
pub trait Clock: Send + Sync {
    /// Current UTC instant.
    fn now(&self) -> DateTime<Utc>;
}

/// Waiting isolated from unit tests and retry policy.
#[unimock::unimock(api = SleeperMock)]
pub trait Sleeper: Send + Sync {
    /// Wait at least the requested interval.
    fn sleep(&self, duration: Duration);
}

/// App JWT signing boundary.
#[unimock::unimock(api = AppJwtMock)]
pub trait AppJwt: Send + Sync {
    /// Sign a short-lived RS256 App credential.
    fn issue(&self) -> Result<Secret>;
}

/// Provider-side installation token creation, without caching.
#[unimock::unimock(api = TokenIssuerMock)]
pub trait TokenIssuer: Send + Sync {
    /// Create a token scoped to the named installation.
    fn issue(&self, installation: i64) -> Result<InstallationToken>;
    /// Mint a fresh token for one repository with only Contents read permission.
    fn issue_repository(&self, installation: i64, repository: i64) -> Result<InstallationToken>;
}

/// Cache storage; the token manager owns expiry and refresh policy.
#[unimock::unimock(api = TokenCacheMock)]
pub trait TokenCache: Send + Sync {
    /// Read a possibly expired entry.
    fn get(&self, installation: i64) -> Result<Option<InstallationToken>>;
    /// Replace an entry after successful refresh.
    fn put(&self, installation: i64, token: InstallationToken) -> Result<()>;
    /// Remove a revoked, suspended or rejected credential.
    fn invalidate(&self, installation: i64) -> Result<()>;
}

/// Installation authentication behavior consumed by repository clients.
#[unimock::unimock(api = TokensMock)]
pub trait Tokens: Send + Sync {
    /// Return a usable token, refreshing before expiry.
    fn get(&self, installation: i64) -> Result<Secret>;
    /// Invalidate a token immediately after access changes or a 401.
    fn invalidate(&self, installation: i64) -> Result<()>;
    /// Mint an attempt credential without reading or writing the shared cache.
    fn repository_read(&self, installation: i64, repository: i64) -> Result<Secret>;
}
