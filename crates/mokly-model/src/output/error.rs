//! Typed validation failures for shared output formats.

use thiserror::Error;

/// Shared output format result.
pub type Result<T> = std::result::Result<T, FormatError>;

/// Ordinary output admission failures retain the rejected path.
#[derive(Debug, Error)]
pub enum AdmissionError {
    /// The path does not use the portable output grammar.
    #[error("[mokly-model/output-admission] The output path is not portable: {path}.")]
    Portable {
        /// Invalid relative output path.
        path: String,
    },
    /// Exact, case, or prefix collision with an admitted or reserved path.
    #[error("[mokly-model/output-admission] Output paths collide: {path} and {other}.")]
    Collision {
        /// New path.
        path: String,
        /// Existing or reserved path.
        other: String,
    },
    /// A regular file exceeds its existing byte limit.
    #[error("[mokly-model/output-admission] Output file exceeds 64 MiB: {path}.")]
    TooLarge {
        /// Rejected file.
        path: String,
    },
}

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
