//! Typed watch setup and classification failures.

/// Watch failures leave the active catalogue in place.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// An operating-system observer could not attach or deliver an event.
    #[error("[mokly-watch/observer] {source}")]
    Observer {
        /// Native observer failure.
        source: notify::Error,
    },
    /// Native event loss requires a repository rescan.
    #[error("[mokly-watch/observer] notifications were lost; rescanning catalogue inputs")]
    Rescan,
    /// Internal failures preserve their typed cause.
    #[error("[mokly-watch/internal] {0}")]
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
