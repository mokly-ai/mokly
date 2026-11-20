//! Stable rejection categories and HTTP translation for upload receivers.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// A public protocol ceiling or documented receiver quota.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Limit {
    /// Compressed request bytes.
    Compressed,
    /// Decompressed tar bytes, including framing.
    Decompressed,
    /// One regular file's bytes.
    File,
    /// Regular file count.
    FileCount,
    /// Upload envelope bytes.
    Manifest,
    /// Ownership inventory bytes.
    Inventory,
    /// Catalogue index bytes.
    Index,
    /// JSON values, containers and object keys.
    JsonNodes,
    /// Simultaneously retained JSON key digests.
    JsonKeys,
    /// JSON value nesting, including the root.
    JsonDepth,
    /// UTF-8 path bytes.
    Path,
    /// Slash-separated segments in a path.
    PathSegments,
    /// Distinct file and directory prefixes in the shared namespace.
    PrefixCount,
    /// Sum of every file size the ownership marker declares.
    DeclaredBytes,
}

/// Structural failures callers may distinguish without parsing diagnostics.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rejection {
    /// Invalid gzip framing, checksum, or trailing compressed data.
    Gzip,
    /// Invalid tar header, padding, checksum, or termination.
    Tar,
    /// An entry body ended before its declared size.
    Truncated,
    /// A link, sparse file, or other unsupported entry type.
    EntryType,
    /// Invalid, unsupported, or dangling PAX metadata.
    Pax,
    /// Invalid UTF-8, unsafe relative path or a reserved cloud/obsolete root.
    Path,
    /// Repeated regular file or inventory path.
    DuplicatePath,
    /// Distinct paths have identical Unicode lowercase keys.
    CaseCollision,
    /// A file is also a directory or ancestor of another entry.
    PathConflict,
    /// Malformed JSON, wrong field types, or extra/missing fields.
    Json,
    /// Repeated JSON object key, including ignored fields.
    DuplicateJsonKey,
    /// Invalid upload envelope values.
    Manifest,
    /// Invalid ownership marker shape.
    Inventory,
    /// Required root file is absent from the archive or the marker.
    MissingFile,
    /// The plan archive holds a directory or a file other than its artifacts.
    PlanFiles,
    /// Archived or stored bytes differ from the declared digest or size.
    ArtifactDigest,
    /// Source or private files violate hosting policy.
    PrivateFile,
    /// Diff files disagree with the selected comparison generation.
    ComparisonFiles,
    /// Envelope and index refer to different comparison baselines or states.
    ComparisonMetadata,
    /// Invalid index read fields or their relationships.
    Index,
    /// Invalid entry detail content or current-index relationships.
    Detail,
}

/// Independently versioned public artifact whose schema is unsupported.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ArtifactKind {
    /// Root upload envelope.
    Envelope,
    /// Export ownership marker.
    Inventory,
    /// Catalogue index document.
    Index,
}

impl ArtifactKind {
    pub(crate) fn at_path(path: &str) -> Option<Self> {
        match path {
            "mokly-upload.json" => Some(Self::Envelope),
            ".mokly-export-artifact" => Some(Self::Inventory),
            "mokly-viewer/index.json" => Some(Self::Index),
            _ => None,
        }
    }
}

/// Validation failure mapped directly by a later HTTP receiver.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// Unsupported artifact schema versions map to HTTP 426.
    #[error("[mkc-mokly-contract/error] unsupported {artifact:?} schema {version:?}")]
    UnsupportedVersion {
        /// Artifact requiring a compatible producer or receiver.
        artifact: ArtifactKind,
        /// Received integer version; absent when the value is not an integer.
        version: Option<u64>,
    },
    /// An inclusive protocol ceiling was exceeded.
    #[error("[mkc-mokly-contract/error] upload limit exceeded: {limit:?}")]
    TooLarge {
        /// The first observed exhausted budget.
        limit: Limit,
    },
    /// The archive or a documented artifact is invalid.
    #[error("[mkc-mokly-contract/error] invalid upload: {reason:?}")]
    Invalid {
        /// Machine-readable rejection, never an arbitrary error string.
        reason: Rejection,
    },
    /// Process-wide validated upload memory is temporarily exhausted.
    #[error("[mkc-mokly-contract/error] upload memory unavailable")]
    Unavailable,
    /// An unexpected receiver failure with source and caller context.
    #[error("[mkc-mokly-contract/error] internal error: {0:?}")]
    Internal(#[from] InternalError),
}

impl Error {
    /// HTTP status from the upload contract; authentication is caller-owned.
    pub fn status_code(&self) -> u16 {
        match self {
            Self::UnsupportedVersion { .. } => 426,
            Self::TooLarge { .. } => 413,
            Self::Invalid { .. } => 400,
            Self::Unavailable => 503,
            Self::Internal(_) => 500,
        }
    }

    /// Stable category understood by Mokly clients.
    pub fn code(&self) -> &'static str {
        match self {
            Self::UnsupportedVersion { .. } => "upload-unsupported-version",
            Self::TooLarge { .. } => "upload-too-large",
            Self::Invalid { .. } => "upload-invalid-bundle",
            Self::Unavailable => "upload-unavailable",
            Self::Internal(_) => "upload-failed",
        }
    }
}

/// Result returned by artifact readers and validators.
pub type Result<T> = result::Result<T, Error>;

pub(crate) fn invalid(reason: Rejection) -> Error {
    Error::Invalid { reason }
}

#[cfg(test)]
#[path = "_tests_/error_tests.rs"]
mod error_tests;
