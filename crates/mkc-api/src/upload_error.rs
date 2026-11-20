//! Upload transport reasons delegated by the single API error boundary.

use internal_error::InternalError;
use mkc_publications::error;
use thiserror::Error;

use crate::error::ApiError;

/// Upload-specific client-safe reasons and status compatibility.
#[derive(Debug, Error, internal_error::ErrorContract, rpc_error::RpcError)]
pub enum UploadError {
    /// A compatible producer or receiver is required.
    ///
    /// One unit variant covers every unsupported artifact version.
    /// Internal domain errors and logs retain the artifact kind and received
    /// version. This boundary exposes neither value in response text or data.
    /// The reason-uniqueness test checks this variant with the API reason catalogue.
    #[error("[mkc-api/upload_error] unsupported version")]
    #[rpc_error(
        code = "failed-precondition",
        reason = "upload-unsupported-version",
        severity = "warn",
        message = "Update Mokly to 0.18.0 and publish again."
    )]
    UnsupportedVersion,
    /// The publication failed validation.
    #[error("[mkc-api/upload_error] invalid bundle")]
    #[rpc_error(
        code = "bad-request",
        reason = "upload-invalid-bundle",
        severity = "warn",
        message = "Run Mokly publish again."
    )]
    InvalidBundle,
    /// Replace the publishing credential.
    #[error("[mkc-api/upload_error] unauthorized")]
    #[rpc_error(
        code = "unauthenticated",
        reason = "upload-unauthorized",
        severity = "warn",
        message = "Use an active project publishing token."
    )]
    Unauthorized,
    /// Correct the project/repository/config selection.
    #[error("[mkc-api/upload_error] forbidden")]
    #[rpc_error(
        code = "permission-denied",
        reason = "upload-forbidden",
        severity = "warn",
        message = "Use the publishing token for this project."
    )]
    Forbidden,
    /// Private projects publish on the Team plan.
    #[error("[mkc-api/upload_error] plan required")]
    #[rpc_error(
        code = "permission-denied",
        reason = "upload-plan-required",
        severity = "warn",
        message = "Upgrade this workspace to Team to publish private projects."
    )]
    PlanRequired,
    /// Reduce the publication size.
    #[error("[mkc-api/upload_error] too large")]
    #[rpc_error(
        code = "payload-too-large",
        reason = "upload-too-large",
        severity = "warn",
        message = "Reduce the catalogue size and publish again."
    )]
    TooLarge,
    /// Retry after admission, upload-memory exhaustion or collection contention.
    #[error("[mkc-api/upload_error] unavailable")]
    #[rpc_error(
        code = "unavailable",
        reason = "upload-unavailable",
        message = "Try publishing again shortly."
    )]
    Unavailable,
    /// A blob body's digest or length differs from its reservation.
    #[error("[mkc-api/upload_error] blob mismatch")]
    #[rpc_error(
        code = "bad-request",
        reason = "upload-blob-mismatch",
        severity = "warn",
        message = "Run Mokly publish again."
    )]
    BlobMismatch,
    /// The upload did not reserve this blob.
    #[error("[mkc-api/upload_error] unknown blob")]
    #[rpc_error(
        code = "not-found",
        reason = "upload-unknown-blob",
        severity = "warn",
        message = "Run Mokly publish again."
    )]
    UnknownBlob,
    /// Completion found files that were not sent yet.
    #[error("[mkc-api/upload_error] incomplete")]
    #[rpc_error(
        code = "aborted",
        reason = "upload-incomplete",
        severity = "warn",
        message = "Send the remaining files, then complete the upload."
    )]
    Incomplete,
    /// The upload attempt expired, failed or was superseded; plan again.
    #[error("[mkc-api/upload_error] expired")]
    #[rpc_error(
        code = "failed-precondition",
        reason = "upload-expired",
        severity = "warn",
        message = "Run Mokly publish again."
    )]
    Expired,
    /// Body reception exceeded its deadline.
    #[error("[mkc-api/upload_error] timeout")]
    #[rpc_error(
        code = "deadline-exceeded",
        reason = "upload-timeout",
        severity = "warn",
        message = "Try publishing again."
    )]
    Timeout,
    /// Internal ingest failure with private diagnostics.
    #[error("[mkc-api/upload_error] failed: {0:?}")]
    #[rpc_error(
        code = "internal",
        reason = "upload-failed",
        message = "Try publishing again shortly."
    )]
    Internal(#[from] InternalError),
}

impl ApiError {
    /// Translate the publication contract explicitly at each HTTP call site.
    #[track_caller]
    pub(crate) fn publication(error: error::Error) -> Self {
        let error = match error {
            error::Error::UnsupportedVersion { artifact, version } => {
                tracing::warn!(?artifact, ?version, "unsupported Mokly artifact version");
                UploadError::UnsupportedVersion
            }
            error::Error::InvalidBundle { .. } => UploadError::InvalidBundle,
            error::Error::TooLarge { .. } => UploadError::TooLarge,
            error::Error::Unauthorized => UploadError::Unauthorized,
            error::Error::Forbidden => UploadError::Forbidden,
            error::Error::PlanRequired => UploadError::PlanRequired,
            error::Error::NotFound => return Self::NotFound,
            error::Error::Unavailable => UploadError::Unavailable,
            error::Error::Expired => UploadError::Expired,
            error::Error::BlobMismatch => UploadError::BlobMismatch,
            error::Error::UnknownBlob => UploadError::UnknownBlob,
            error::Error::Incomplete => UploadError::Incomplete,
            error => UploadError::internal(error),
        };
        Self::Upload(error)
    }
}
