//! Typed watch setup and classification failures.

use std::path::PathBuf;

/// Watch failures leave the active catalogue in place.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// An operating-system observer could not attach or deliver an event.
    #[error("[mokly/watch] cannot observe {path}: {source}")]
    Observer {
        /// Requested lexical path.
        path: PathBuf,
        /// Native observer failure.
        source: notify::Error,
    },
    /// Internal failures preserve their typed cause.
    #[error("[mokly/watch] {0}")]
    Internal(#[from] InternalError),
}

/// Failures that callers report without branching.
#[derive(Debug, thiserror::Error)]
pub enum InternalError {
    /// An already validated glob could not compile.
    #[error("watch pattern could not compile: {source}")]
    Glob {
        /// Glob parser failure.
        source: globset::Error,
    },
    /// A source traversal failed.
    #[error("watch directory could not be read: {source}")]
    Source {
        /// Source-tree failure.
        source: mokly_source_interface::error::SourceError,
    },
}

/// Watch operation result.
pub type Result<T> = std::result::Result<T, Error>;
