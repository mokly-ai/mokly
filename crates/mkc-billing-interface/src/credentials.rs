//! Secret-bearing credentials and injectable runtime dependencies.

use std::fmt;
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::Deserialize;

/// Credential with redacted diagnostics and no serialization implementation.
#[derive(Clone, Deserialize)]
#[serde(transparent)]
pub struct Secret(String);

impl Secret {
    /// Wrap a credential obtained from secure configuration.
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

/// Clock shared by verification and retry policy.
#[unimock::unimock(api = ClockMock)]
pub trait Clock: Send + Sync {
    /// Return the current UTC instant.
    fn now(&self) -> DateTime<Utc>;
}

/// Blocking wait isolated from retry policy and unit tests.
#[unimock::unimock(api = SleeperMock)]
pub trait Sleeper: Send + Sync {
    /// Wait at least the requested interval.
    fn sleep(&self, duration: Duration);
}

#[cfg(test)]
#[path = "_tests_/credentials_tests.rs"]
mod tests;
