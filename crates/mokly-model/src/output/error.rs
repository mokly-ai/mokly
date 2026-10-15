//! Typed validation failures for shared output formats.

use thiserror::Error;

/// Shared output format result.
pub type Result<T> = std::result::Result<T, FormatError>;

/// Shape and limit failures classified by upload and static-build consumers.
#[derive(Debug, Error)]
pub enum FormatError {
    /// Malformed fields, paths, addresses or JSON.
    #[error("[mokly-model/output-invalid] Invalid output format.")]
    InvalidBundle,
    /// A documented byte or path ceiling was exceeded.
    #[error("[mokly-model/output-too-large] Output exceeds a format limit.")]
    TooLarge,
    /// A present version is not supported.
    #[error("[mokly-model/output-version] Unsupported output format version.")]
    UnsupportedVersion,
    /// No valid portable repository identity could be formed.
    #[error("[mokly-model/output-repository] Invalid repository identity.")]
    Repository,
}
