//! One received request reduced to what the recordings depend on.

use crate::error::{Error, Result};

/// The OAuth token exchange, the one request answered off the API origin.
pub(crate) const TOKEN_PATH: &str = "/login/oauth/access_token";

/// A request as the double sees it, independent of the HTTP server type.
#[derive(Clone, Debug, Default)]
pub struct Received {
    /// Request method, uppercase.
    pub method: String,
    /// Request target, including any query string.
    pub path: String,
    /// Request body, empty for reads.
    pub body: String,
    /// `Accept` header, which GitHub clients always send.
    pub accept: Option<String>,
    /// `X-GitHub-Api-Version` header.
    pub api_version: Option<String>,
    /// `User-Agent` header, which must identify Mokly.
    pub user_agent: Option<String>,
    /// `Authorization` header, absent only on the token exchange.
    pub authorization: Option<String>,
}

impl Received {
    /// Reject any request the real provider would not have accepted.
    pub(crate) fn verify(&self) -> Result<()> {
        if self.api_version.as_deref() != Some("2022-11-28") {
            return Err(Error::Header {
                name: "X-GitHub-Api-Version",
            });
        }
        if !self
            .user_agent
            .as_deref()
            .is_some_and(|agent| agent.starts_with("Mokly"))
        {
            return Err(Error::Header { name: "User-Agent" });
        }
        let token = self.path == TOKEN_PATH;
        let accept = if token {
            "application/json"
        } else {
            "application/vnd.github+json"
        };
        if self.accept.as_deref() != Some(accept) {
            return Err(Error::Header { name: "Accept" });
        }
        if !token
            && !self
                .authorization
                .as_deref()
                .is_some_and(|value| value.starts_with("Bearer "))
        {
            return Err(Error::Header {
                name: "Authorization",
            });
        }
        Ok(())
    }

    /// The failure reported when no recording covers this request.
    pub(crate) fn unrecorded(&self) -> Error {
        Error::Unrecorded {
            method: self.method.clone(),
            path: self.path.clone(),
        }
    }
}
