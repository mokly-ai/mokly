//! Typed failures of base preparation and its IO boundaries.

use std::io;
use std::path::PathBuf;

use mokly_git::error;
use thiserror::Error;

/// Base preparation result.
pub type Result<T> = std::result::Result<T, Error>;

/// Recoverable preparation failures.
#[derive(Debug, Error)]
pub enum Error {
    /// A package-manager pipe exceeded its capture budget.
    #[error("[mokly-compare/install] command output exceeds 1 MiB per stream")]
    CommandOutputLimit,
    /// Git source data could not be read.
    #[error("[mokly-compare/git] {source}")]
    Git {
        /// Original typed Git failure.
        source: error::Error,
    },
    /// Preparation was cancelled by its generation owner.
    #[error("[mokly-compare/base] preparation cancelled")]
    Cancelled,
    /// The cache cannot hold this entry alongside active leases.
    #[error("[mokly-compare/cache] cache exceeds its {limit}-byte bound")]
    CacheLimit {
        /// Maximum retained bytes.
        limit: u64,
    },
    /// Cache path or metadata is unsafe.
    #[error("[mokly-compare/cache] unsafe cache path {path:?}")]
    UnsafeCache {
        /// Rejected filesystem path.
        path: PathBuf,
    },
    /// Package-manager command is unavailable or failed.
    #[error("[mokly-compare/install] package manager exited with status {status:?}")]
    InstallFailed {
        /// Exit status, absent if the manager could not start.
        status: Option<i32>,
    },
    /// The dependency install reached its deadline.
    #[error("[mokly-compare/install] dependency install reached its time limit")]
    InstallTimeout,
    /// No supported manager or lockfile is available.
    #[error("[mokly-compare/install] unsupported package manager or lockfile")]
    UnsupportedManager,
    /// A requested dependency input was not a regular confined source.
    #[error("[mokly-compare/dependencies] invalid dependency input {path:?}")]
    InvalidInput {
        /// Repository-relative input.
        path: String,
    },
    /// Adapter failure with a preserved source type.
    #[error("[mokly-compare/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Internal adapter source errors.
#[derive(Debug, Error)]
pub enum InternalError {
    /// Cache receipt encoding failed.
    #[error("JSON encoding failed: {source}")]
    Json {
        /// Original serialization failure.
        source: serde_json::Error,
    },
    /// Filesystem or process operation failed.
    #[error("I/O failed: {source}")]
    Io {
        /// Original IO failure.
        source: io::Error,
    },
    /// Platform ownership failed.
    #[error("platform operation failed: {source}")]
    Platform {
        /// Original platform failure.
        source: mokly_platform::error::Error,
    },
    /// Worker thread failed to settle.
    #[error("pipe worker failed")]
    Worker,
}

pub(crate) trait IoResult<T> {
    fn base(self) -> Result<T>;
}

impl<T> IoResult<T> for io::Result<T> {
    #[track_caller]
    fn base(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::Internal(InternalError::Io { source })),
        }
    }
}

pub(crate) trait GitResult<T> {
    fn base(self) -> Result<T>;
}

impl<T> GitResult<T> for error::Result<T> {
    #[track_caller]
    fn base(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(error::Error::Cancelled) => Err(Error::Cancelled),
            Err(source) => Err(Error::Git { source }),
        }
    }
}
