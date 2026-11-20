//! Stable provider outcomes that callers can handle explicitly.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// Provider failures; unhandled details remain in the internal source chain.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// Invalid caller-supplied provider request.
    #[error("[mkc-github-interface/error] invalid request")]
    InvalidRequest,
    /// A credential was rejected and may need renewal.
    #[error("[mkc-github-interface/error] unauthorized")]
    Unauthorized,
    /// The credential does not authorize this operation.
    #[error("[mkc-github-interface/error] forbidden")]
    Forbidden,
    /// The requested provider resource is absent or inaccessible.
    #[error("[mkc-github-interface/error] not found")]
    NotFound,
    /// An OAuth authorization code is invalid or already consumed.
    #[error("[mkc-github-interface/error] invalid OAuth code")]
    InvalidCode,
    /// GitHub explicitly rejected admission; honor this minimum delay.
    #[error("[mkc-github-interface/error] rate limited for {retry_after} seconds")]
    RateLimited {
        /// Positive seconds before retrying.
        retry_after: u64,
    },
    /// A transient provider outage permits a later retry.
    #[error("[mkc-github-interface/error] unavailable")]
    Unavailable,
    /// A client HTTP rejection without a more specific handled category.
    #[error("[mkc-github-interface/error] HTTP {status}")]
    Http {
        /// Provider response status, retained for delivery retry classification.
        status: u16,
    },
    /// Unhandled provider, transport, signing or serialization failure.
    #[error("[mkc-github-interface/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Result returned by all provider traits.
pub type Result<T> = result::Result<T, Error>;
