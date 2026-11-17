//! Authentication failures independent of HTTP transport codes.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// Handled authentication conditions and preserved internal failures.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// Unknown or malformed email input.
    #[error("[mkc-auth/error] invalid input")]
    InvalidInput,
    /// Missing, unknown or revoked session.
    #[error("[mkc-auth/error] unauthenticated")]
    Unauthenticated,
    /// Stored session has passed its absolute or idle deadline.
    #[error("[mkc-auth/error] session expired")]
    SessionExpired,
    /// Origin or session-bound CSRF token did not match.
    #[error("[mkc-auth/error] csrf failed")]
    CsrfFailed,
    /// Magic-link credential is malformed or unknown.
    #[error("[mkc-auth/error] invalid link")]
    InvalidLink,
    /// Preview sign-in is absent from this deployment.
    #[error("[mkc-auth/error] preview sign-in unavailable")]
    PreviewSignInUnavailable,
    /// Unused magic link has passed its deadline.
    #[error("[mkc-auth/error] link expired")]
    LinkExpired,
    /// Magic link has already been exchanged.
    #[error("[mkc-auth/error] link used")]
    LinkUsed,
    /// Admission is denied for this many seconds.
    #[error("[mkc-auth/error] retry after {0} seconds")]
    RateLimited(i64),
    /// Preserved dependency failure, safe only for server diagnostics.
    #[error("[mkc-auth/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Authentication operation result.
pub type Result<T> = result::Result<T, Error>;
