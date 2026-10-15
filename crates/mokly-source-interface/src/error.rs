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
}

impl SourceError {
    /// Whether a node vanished or became a non-directory during discovery.
    pub fn is_vanished(&self) -> bool {
        let Self::Io { source, .. } = self;
        matches!(
            source.kind(),
            io::ErrorKind::NotFound | io::ErrorKind::NotADirectory
        )
    }

    /// Portable error code for the configuration diagnostic.
    pub fn code(&self) -> &'static str {
        let Self::Io { source, .. } = self;
        match source.kind() {
            io::ErrorKind::NotFound => "ENOENT",
            io::ErrorKind::NotADirectory => "ENOTDIR",
            io::ErrorKind::PermissionDenied => "EACCES",
            io::ErrorKind::InvalidInput => "EINVAL",
            _ => "unknown",
        }
    }
}
