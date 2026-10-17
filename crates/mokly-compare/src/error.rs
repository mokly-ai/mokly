//! Typed failures of base preparation and its IO boundaries.

use std::io;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_git::error;
use thiserror::Error;

/// Base preparation result.
pub type Result<T> = std::result::Result<T, Error>;

/// Recoverable preparation failures.
#[derive(Debug, Error)]
pub enum Error {
    /// The retained removal has no matching public base record or detail.
    #[error("[mokly-compare/projection] removed record is missing for {path}")]
    RemovedRecord {
        /// Historical entry path.
        path: String,
    },
    /// A base render plan names an absent catalogue entry.
    #[error("[mokly-compare/projection] historical plan {route} names missing entry {entry}")]
    HistoricalPlanEntry {
        /// Historical document route.
        route: String,
        /// Missing catalogue entry index.
        entry: usize,
    },
    /// A planned historical render did not retain its composed document.
    #[error("[mokly-compare/projection] historical document is missing for {route}")]
    HistoricalDocument {
        /// Historical document route.
        route: String,
    },

    /// A bounded source operation cannot classify this path.
    #[error("[mokly-compare/limit] {path}: {source}")]
    Limit {
        /// Requested source path or root.
        path: String,
        /// Typed budget failure.
        source: error::Error,
    },
    /// Original Git IO failure retained while the authoring layer emits its diagnostics.
    #[error("[mokly-compare/source] {source}")]
    SourceFailure {
        /// Typed original adapter error.
        source: Arc<Error>,
    },
    /// Historical source validation failed at a named immutable base.
    #[error("[mokly-compare/base] base {commit}: {source}")]
    Base {
        /// Pinned historical commit.
        commit: String,
        /// Typed validation or preparation failure.
        source: Box<Error>,
    },
    /// Catalogue configuration or historical sources failed current validation.
    #[error("[mokly-compare/catalogue] {source}")]
    Catalogue {
        /// Original validation diagnostics.
        source: mokly_catalogue::error::CatalogueError,
    },
    /// A rendered document or resource failed validation.
    #[error("[mokly-compare/render] {source}")]
    Graph {
        /// Original graph diagnostics.
        source: mokly_graph::error::GraphError,
    },
    /// A complete result failed its strict model contract.
    #[error("[mokly-compare/review-invalid] {source}")]
    Review {
        /// Original strict reader diagnostic.
        source: mokly_model::readers::ReadError,
    },

    /// The selected package manager executable could not be started.
    #[error("[mokly-compare/install] package manager is unavailable")]
    CommandUnavailable,
    /// A local package path leaves the repository source root.
    #[error("[mokly-compare/dependencies] local package is outside the repository: {path:?}")]
    LocalOutside {
        /// Rejected authored specification.
        path: String,
    },
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
    /// A resource read did not retain its comparison fact.
    #[error("resource fact is missing for {route}")]
    MissingResourceFact {
        /// Requested public route.
        route: String,
    },
    /// Pairing must retain at least one side of every identity.
    #[error("entry pairing has neither side")]
    EmptyPair,
    /// Pure model serialization failed.
    #[error("model encoding failed: {source}")]
    Model {
        /// Original serialization source.
        source: mokly_model::error::ModelError,
    },

    /// Source-index initialization could not acquire its state.
    #[error("source index state is poisoned")]
    Poisoned,
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
    fn at_path(self, path: &str) -> Result<T>;
}

impl<T> GitResult<T> for error::Result<T> {
    fn at_path(self, path: &str) -> Result<T> {
        match self {
            Err(error::Error::BlobLimit { path, limit }) => Err(Error::Limit {
                path,
                source: error::Error::ByteLimit { limit },
            }),
            Err(source) if source.is_limit() => Err(Error::Limit {
                path: path.into(),
                source,
            }),
            result => result.base(),
        }
    }
    #[track_caller]
    fn base(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(error::Error::Cancelled) => Err(Error::Cancelled),
            Err(source) => Err(Error::Git { source }),
        }
    }
}

pub(crate) trait PlatformResult<T> {
    fn base(self) -> Result<T>;
}

impl<T> PlatformResult<T> for mokly_platform::error::Result<T> {
    #[track_caller]
    fn base(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(InternalError::Platform { source }.into()),
        }
    }
}
