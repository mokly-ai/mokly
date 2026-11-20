//! Safe input and log-sink error contract.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// Invalid request fields, named without reflecting caller bytes.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestField {
    /// Canonical GitHub owner and repository name.
    Repository,
    /// Full lowercase Git object identifier.
    HeadSha,
    /// Git branch name.
    Branch,
    /// Repository-relative configuration path.
    ConfigPath,
    /// Project publication upload endpoint.
    UploadEndpoint,
    /// Empty or structurally invalid credential.
    Credential,
}

/// Errors from request construction and the persistence-independent log sink.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// A caller supplied an invalid field.
    #[error("[mkc-build-interface/error] invalid request field: {field:?}")]
    InvalidRequest {
        /// Rejected field; its value is never included.
        field: RequestField,
    },
    /// Unhandled sink or implementation failure.
    #[error("[mkc-build-interface/error] internal failure")]
    Internal(#[from] InternalError),
}

/// Result of request validation or log delivery.
pub type Result<T> = result::Result<T, Error>;

impl Error {
    /// Convert a safe error into an outcome's internal source chain.
    #[track_caller]
    pub fn into_internal(self) -> InternalError {
        match self {
            Self::Internal(error) => error,
            error => InternalError::from_source(Self::DEFINED_AT, error),
        }
    }
}
