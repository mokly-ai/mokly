//! Command failures remain separate from the HTTP error and reason catalogue.

use std::{fmt, result};

use internal_error::InternalError;
use thiserror::Error;

/// Failures of the one-time preview seed command.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// Preview sign-in settings must be present after capability validation.
    #[error("[mkc-api/preview_seed] preview seed requires preview sign-in settings")]
    Configuration,
    /// Preserved dependency or seed-validation failure.
    #[error("[mkc-api/preview_seed] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Result of a preview seed operation.
pub type Result<T> = result::Result<T, Error>;

#[derive(Debug, Error)]
pub(super) enum Failure {
    #[error("[mkc-api/preview_seed] request missing")]
    RequestMissing,
    #[error("[mkc-api/preview_seed] invalid request {field}")]
    InvalidRequest { field: &'static str },
    #[error("[mkc-api/preview_seed] catalogue missing")]
    CatalogueMissing,
    #[error("[mkc-api/preview_seed] catalogue envelope missing")]
    EnvelopeMissing,
    #[error("[mkc-api/preview_seed] {field} must be {expected:?}; received {received:?}")]
    Mismatch {
        field: &'static str,
        expected: String,
        received: String,
    },
    #[error("[mkc-api/preview_seed] unexpected action reply")]
    UnexpectedReply,
    #[error("[mkc-api/preview_seed] ready publication has no metadata")]
    MetadataMissing,
    #[error("[mkc-api/preview_seed] pullRequest must be {expected:?}; received {received:?}")]
    PullRequest {
        expected: Option<i64>,
        received: Option<i64>,
    },
}

pub(super) fn require<T: fmt::Display + PartialEq>(
    field: &'static str,
    expected: T,
    received: T,
) -> Result<()> {
    if expected == received {
        return Ok(());
    }
    Err(Error::internal(Failure::Mismatch {
        field,
        expected: expected.to_string(),
        received: received.to_string(),
    }))
}
