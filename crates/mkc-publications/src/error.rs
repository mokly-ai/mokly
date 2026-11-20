//! Publication policy and ingest failures, independent of HTTP transport.

use std::result;

use internal_error::InternalError;
use mkc_domain::blob::BlobKey;
use mkc_domain::ids::PublicationId;
use mkc_mokly_contract::error::{ArtifactKind, Limit, Rejection};
use mkc_store_interface::publication::PublicationFailure;
use thiserror::Error;

/// Outcomes callers explicitly translate or recover from.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// A compatible artifact version is required.
    #[error("[mkc-publications/error] unsupported {artifact:?} schema {version:?}")]
    UnsupportedVersion {
        /// Versioned artifact that needs an upgrade.
        artifact: ArtifactKind,
        /// Received integer schema number; absent when it is not an integer.
        version: Option<u64>,
    },
    /// The public contract rejected the body.
    #[error("[mkc-publications/error] invalid bundle: {reason:?}")]
    InvalidBundle {
        /// Typed structural rejection.
        reason: Rejection,
    },
    /// A receiver quota was exceeded.
    #[error("[mkc-publications/error] upload limit: {limit:?}")]
    TooLarge {
        /// First observed exhausted budget.
        limit: Limit,
    },
    /// Missing, unknown, revoked or malformed credential.
    #[error("[mkc-publications/error] unauthorized")]
    Unauthorized,
    /// Token or metadata names another project/repository/config.
    #[error("[mkc-publications/error] forbidden publication")]
    Forbidden,
    /// Private publication writes require the Team plan.
    #[error("[mkc-publications/error] plan required for private publication")]
    PlanRequired,
    /// The publication/project is absent, expired or inaccessible.
    #[error("[mkc-publications/error] publication not found")]
    NotFound,
    /// Temporary reservation conflict or unavailable repository protection.
    #[error("[mkc-publications/error] dependency unavailable")]
    Unavailable,
    /// The upload attempt expired, failed or was superseded without a ready publication.
    #[error("[mkc-publications/error] upload attempt expired")]
    Expired,
    /// A blob body's digest or length differs from its reservation.
    #[error("[mkc-publications/error] blob does not match its reservation")]
    BlobMismatch,
    /// The attempt did not reserve this blob hash.
    #[error("[mkc-publications/error] blob is not part of this upload")]
    UnknownBlob,
    /// Completion found reserved blobs that are not yet durable.
    #[error("[mkc-publications/error] upload has blobs still to send")]
    Incomplete,
    /// Internal dependency failure with preserved source and call site.
    #[error("[mkc-publications/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

impl Error {
    /// Persistable failure without transport or internal diagnostics.
    pub fn failure(&self) -> PublicationFailure {
        match self {
            Self::UnsupportedVersion { .. } => PublicationFailure::UnsupportedVersion,
            Self::InvalidBundle { .. } => PublicationFailure::InvalidBundle,
            Self::TooLarge { .. } => PublicationFailure::TooLarge,
            Self::Unauthorized | Self::Forbidden | Self::PlanRequired | Self::NotFound => {
                PublicationFailure::Unauthorized
            }
            Self::Expired => PublicationFailure::Expired,
            Self::BlobMismatch | Self::UnknownBlob | Self::Incomplete => {
                PublicationFailure::InvalidBundle
            }
            Self::Unavailable | Self::Internal(_) => PublicationFailure::Internal,
        }
    }
}

/// Result of publication behavior.
pub type Result<T> = result::Result<T, Error>;

/// Durability invariant failures that callers must not branch on.
#[derive(Debug, Error)]
pub(crate) enum DurabilityFailure {
    /// A referenced incarnation stopped accepting durability confirmation.
    #[error("[mkc-publications/error] blob confirmation rejected for {key:?}")]
    BlobConfirmationRejected {
        /// Exact incarnation that the upload reserved and wrote.
        key: BlobKey,
    },
    /// The ready transaction would publish an attempt whose stored index
    /// completion could not reload.
    #[error("[mkc-publications/error] publication {publication} lost its stored index")]
    StoredIndexMissing {
        /// Attempt whose plan stored the index.
        publication: PublicationId,
    },
    /// Completion could not reload an ownership-listed detail of a live upload.
    #[error("[mkc-publications/error] publication {publication} lost stored detail {path}")]
    StoredDetailMissing {
        /// Attempt whose marker declared the detail.
        publication: PublicationId,
        /// Export-relative detail path.
        path: String,
    },
    /// Verified stored bytes no longer match the reserved file size.
    #[error(
        "[mkc-publications/error] stored artifact {path} has {actual} bytes, expected {expected}"
    )]
    StoredArtifactSize {
        /// Export-relative artifact path.
        path: String,
        /// Accepted declaration for the stored object.
        expected: i64,
        /// Length read from storage.
        actual: usize,
    },
    /// A ready transition observed references without confirmed bytes.
    #[error("[mkc-publications/error] publication {publication} has {count} pending durable blobs")]
    PendingPublicationBlobs {
        /// Attempt that still owns non-durable references.
        publication: PublicationId,
        /// Number of distinct hashes still pending.
        count: usize,
    },
}
