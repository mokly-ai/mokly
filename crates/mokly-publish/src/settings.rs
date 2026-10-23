//! Validated request credentials and same-origin URL boundaries.

use std::fmt;

use url::Url;

use crate::error::{Error, Result};
use crate::redaction::SecretMatcher;

/// A validated bearer credential, deliberately opaque in diagnostics.
#[derive(Clone)]
pub struct Token(String);

impl Token {
    /// Require the RFC bearer-token grammar, including trailing padding.
    pub fn new(value: String) -> Result<Self> {
        let core = value.trim_end_matches('=');
        if core.is_empty()
            || !core
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"._~+/-".contains(&byte))
        {
            return Err(Error::Token);
        }
        Ok(Self(value))
    }

    /// Expose the credential only to an HTTP implementation. Never log this value.
    pub fn expose(&self) -> &str {
        &self.0
    }

    /// Create the shared matcher used by completion and terminal consumers.
    pub fn matcher(&self) -> SecretMatcher {
        SecretMatcher::new(self.0.clone())
    }
}

impl fmt::Debug for Token {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Token([redacted])")
    }
}

/// One fully validated upload configuration.
#[derive(Clone, Debug)]
pub struct Settings {
    /// Exact configured Plan target, with its path and query retained.
    pub(crate) endpoint: Url,
    /// Secret credential, never included in logs or error messages.
    pub(crate) token: Token,
    /// Concurrent Blob request bound, inclusive 1 through 32.
    pub(crate) concurrency: u8,
}

impl Settings {
    /// Exact normalized Plan endpoint, retaining its path and query.
    pub fn endpoint(&self) -> &Url {
        &self.endpoint
    }
    /// Credential for a caller-owned HTTP adapter.
    pub fn token(&self) -> &Token {
        &self.token
    }
    /// Maximum concurrent Blob requests.
    pub fn concurrency(&self) -> u8 {
        self.concurrency
    }

    /// Validate the resolved explicit options or environment fallbacks.
    pub fn new(endpoint: &str, token: String, concurrency: u8) -> Result<Self> {
        let Ok(endpoint) = Url::parse(endpoint) else {
            return Err(Error::Endpoint);
        };
        if !request_url(&endpoint) || endpoint.fragment().is_some() {
            return Err(Error::Endpoint);
        }
        if !(1..=32).contains(&concurrency) {
            return Err(Error::Concurrency);
        }
        Ok(Self {
            endpoint,
            token: Token::new(token)?,
            concurrency,
        })
    }

    /// Validate a receiver URL against the configured endpoint's origin.
    pub fn receiver_url(&self, value: &str) -> Result<Url> {
        let Ok(url) = Url::parse(value) else {
            return Err(Error::Failed);
        };
        if !request_url(&url) || url.origin() != self.endpoint.origin() {
            return Err(Error::Failed);
        }
        Ok(url)
    }
}

pub(crate) fn request_url(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
}
