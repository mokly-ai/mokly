//! Typed platform failures.

use std::io;
use std::path::PathBuf;

use thiserror::Error;

/// Platform operation result.
pub type Result<T> = std::result::Result<T, Error>;

/// Recoverable operating-system failures.
#[derive(Debug, Error)]
pub enum Error {
    /// An exclusive rename would replace a destination.
    #[error("[mokly-platform/rename] destination exists: {path}")]
    DestinationExists {
        /// Protected destination.
        path: PathBuf,
    },
    /// Another process holds the requested file lock.
    #[error("[mokly-platform/lock] lock is held: {path}")]
    Locked {
        /// Contended lock file.
        path: PathBuf,
    },
    /// A path contains a NUL byte and cannot reach the OS.
    #[error("[mokly-platform/path] path contains a NUL byte: {path}")]
    InvalidPath {
        /// Rejected path.
        path: PathBuf,
    },
    /// An operating-system adapter failed.
    #[error("[mokly-platform/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Internal operating-system source error.
#[derive(Debug, Error)]
pub enum InternalError {
    /// An I/O operation failed.
    #[error("operating-system operation failed: {source}")]
    Io {
        /// Original OS error.
        source: io::Error,
    },
}

/// Preserve I/O source errors at adapter boundaries.
pub(crate) trait IoResult<T> {
    /// Promote an OS result to the platform error contract.
    fn platform(self) -> Result<T>;
}

impl<T> IoResult<T> for io::Result<T> {
    #[track_caller]
    fn platform(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::Internal(InternalError::Io { source })),
        }
    }
}
