//! Typed source IO failures shared by every adapter.

use std::io;
use std::path::PathBuf;

use thiserror::Error;

/// Source operation result.
pub type Result<T> = std::result::Result<T, SourceError>;

/// Source failures retain the operation, path, and original IO error.
#[derive(Debug, Error)]
pub enum SourceError {
    /// A source operation failed.
    #[error("[mokly-source-interface/io] {operation} {}: {source}", path.display())]
    Io {
        /// Stable operation name.
        operation: &'static str,
        /// Source-tree path, kept private from public JSON.
        path: PathBuf,
        /// Original error.
        source: io::Error,
    },
    /// An adapter failure that retains its original non-IO source type.
    #[error("[mokly-source-interface/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Adapter failures that do not belong to the portable IO contract.
#[derive(Debug, Error)]
pub enum InternalError {
    /// A source-tree backend failed without an IO error conversion.
    #[error("{operation} {}: {source}", path.display())]
    Adapter {
        /// Source-tree operation.
        operation: &'static str,
        /// Private source-tree path.
        path: PathBuf,
        /// Original typed backend error, available through downcasting.
        source: Box<dyn std::error::Error + Send + Sync>,
    },
}

impl SourceError {
    /// Whether a node vanished or became a non-directory during discovery.
    pub fn is_vanished(&self) -> bool {
        let Self::Io { source, .. } = self else {
            return false;
        };
        matches!(
            source.kind(),
            io::ErrorKind::NotFound | io::ErrorKind::NotADirectory
        )
    }

    /// Portable error code for the configuration diagnostic.
    pub fn code(&self) -> &'static str {
        let Self::Io { source, .. } = self else {
            return "unknown";
        };
        #[cfg(unix)]
        match source.raw_os_error() {
            Some(libc::ELOOP) => return "ELOOP",
            Some(libc::ENAMETOOLONG) => return "ENAMETOOLONG",
            _ => {}
        }
        match source.kind() {
            io::ErrorKind::NotFound => "ENOENT",
            io::ErrorKind::NotADirectory => "ENOTDIR",
            io::ErrorKind::PermissionDenied => "EACCES",
            io::ErrorKind::InvalidInput => "EINVAL",
            _ => "unknown",
        }
    }
}

#[cfg(test)]
#[path = "_tests_/error_tests.rs"]
mod error_tests;
