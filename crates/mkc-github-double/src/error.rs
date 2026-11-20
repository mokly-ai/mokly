//! Typed failures the double answers with instead of panicking its host.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// Every way a recorded answer can fail to be produced.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// No recording covers this method and target.
    #[error("[mkc-github-double/error] unrecorded request: {method} {path}")]
    Unrecorded {
        /// Request method exactly as received.
        method: String,
        /// Request target exactly as received.
        path: String,
    },
    /// A request omitted or altered a header the GitHub client always sends.
    #[error("[mkc-github-double/error] unexpected request header: {name}")]
    Header {
        /// Header field name.
        name: &'static str,
    },
    /// The token exchange did not present the registered App credentials.
    #[error("[mkc-github-double/error] unexpected OAuth field: {name}")]
    OAuth {
        /// JSON field name in the token request body.
        name: &'static str,
    },
    /// A token or check-run request body differs from what GitHub accepts.
    #[error("[mkc-github-double/error] unexpected request field: {name}")]
    Field {
        /// JSON field name in the request body.
        name: &'static str,
    },
    /// A recording, the listener or a response could not be handled.
    #[error("[mkc-github-double/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

impl Error {
    /// The HTTP status the double answers a failed request with.
    pub fn status(&self) -> u16 {
        match self {
            Self::Unrecorded { .. } => 501,
            Self::Header { .. } | Self::OAuth { .. } | Self::Field { .. } => 400,
            Self::Internal(_) => 500,
        }
    }
}

/// Result of producing one recorded answer.
pub type Result<T> = result::Result<T, Error>;
