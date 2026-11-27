//! Credentials with no serialization and redacted diagnostics.

use std::fmt;

use crate::error::{Error, RequestField, Result};

/// A token exposed only at the credential-write or process-environment boundary.
#[derive(Clone)]
pub struct Secret(String);

impl Secret {
    /// Wrap a nonempty credential safe for Git's URL credential-file grammar.
    ///
    /// The value holds only ASCII letters, digits, `.`, `_`, and `-`, which
    /// are RFC 3986 unreserved characters and need no percent-encoding in URL
    /// userinfo. GitHub installation tokens use `.` as a separator.
    pub fn new(value: impl Into<String>) -> Result<Self> {
        let value = value.into();
        if value.is_empty()
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
        {
            return Err(Error::InvalidRequest {
                field: RequestField::Credential,
            });
        }
        Ok(Self(value))
    }

    /// Borrow the credential for its intended authenticated boundary.
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("[redacted]")
    }
}
