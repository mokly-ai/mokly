//! Typed platform failures.

use std::io;
use std::panic::Location;
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
        /// Conversion call site, shown only by debug formatting.
        defined_at: &'static Location<'static>,
    },
}

impl Error {
    /// Preserve the I/O source and capture its conversion call site.
    #[track_caller]
    pub fn io(source: io::Error) -> Self {
        Self::Internal(InternalError::Io {
            source,
            defined_at: Location::caller(),
        })
    }
}

/// Preserve I/O source errors and conversion call sites at adapter boundaries.
pub(crate) trait IoResult<T> {
    /// Promote an OS result to the platform error contract.
    fn platform(self) -> Result<T>;
}

impl<T> IoResult<T> for io::Result<T> {
    #[track_caller]
    fn platform(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::io(source)),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/error_tests.rs"]
mod error_tests;
