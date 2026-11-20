//! Catalogue HTTP errors rendered through the shared RPC envelope.

use std::result;

use internal_error::InternalError;
use mkc_publications::error;
use thiserror::Error;

/// Client-safe catalogue transport failures.
#[derive(Debug, Error, internal_error::ErrorContract, rpc_error::RpcError)]
pub enum Error {
    /// Reopen access from the authenticated app.
    #[error("[mkc-catalogue-server/error] unauthenticated")]
    #[rpc_error(
        code = "unauthenticated",
        reason = "unauthenticated",
        severity = "warn",
        message = "Open this catalogue from your project."
    )]
    Unauthorized,
    /// Unknown host or inaccessible publication.
    #[error("[mkc-catalogue-server/error] not-found")]
    #[rpc_error(
        code = "not-found",
        reason = "not-found",
        severity = "warn",
        message = "This catalogue is unavailable."
    )]
    NotFound,
    /// Malformed path, host or exchange request.
    #[error("[mkc-catalogue-server/error] validation-failed")]
    #[rpc_error(
        code = "bad-request",
        reason = "validation-failed",
        severity = "warn",
        message = "Check the link and try again."
    )]
    InvalidRequest,
    /// Cross-origin grant exchange rejected.
    #[error("[mkc-catalogue-server/error] permission-denied")]
    #[rpc_error(
        code = "permission-denied",
        reason = "permission-denied",
        severity = "warn",
        message = "Open this catalogue from your project."
    )]
    Forbidden,
    /// Unhandled storage or runtime failure, with private source context.
    #[error("[mkc-catalogue-server/error] internal: {0:?}")]
    #[rpc_error(
        code = "internal",
        reason = "internal-error",
        message = "Please try again shortly."
    )]
    Internal(#[from] InternalError),
}

/// Catalogue boundary result.
pub type Result<T> = result::Result<T, Error>;

impl Error {
    /// Explicit policy mapping retaining internal source and caller context.
    #[track_caller]
    pub(crate) fn publication(error: error::Error) -> Self {
        match error {
            error::Error::Unauthorized => Self::Unauthorized,
            error::Error::NotFound => Self::NotFound,
            error::Error::Forbidden => Self::Forbidden,
            error => Self::internal(error),
        }
    }
}
