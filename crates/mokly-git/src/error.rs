//! Git runner error contract.

use std::io;
use std::path::PathBuf;

use mokly_platform::error;
use thiserror::Error;

/// Git operation result.
pub type Result<T> = std::result::Result<T, Error>;

/// Typed Git execution failures.
#[derive(Debug, Error)]
pub enum Error {
    /// Malformed immutable object identity.
    #[error("[mokly-git/identity] expected a full Git object id")]
    InvalidObjectId,
    /// A path escapes or has no portable repository identity.
    #[error("[mokly-git/identity] invalid repository path {path:?}")]
    InvalidPath {
        /// Rejected lexical path.
        path: String,
    },
    /// Source paths must have a Unicode POSIX identity.
    #[error("[mokly-git/identity] path is not UTF-8")]
    PathEncoding,
    /// Git returned invalid or truncated structured data.
    #[error("[mokly-git/read] malformed Git output")]
    MalformedOutput,
    /// The configured root is not the actual checkout root.
    #[error("[mokly-git/root] repository root {configured:?} differs from Git root {actual:?}")]
    RootMismatch {
        /// Configured filesystem identity.
        configured: PathBuf,
        /// Git checkout filesystem identity.
        actual: PathBuf,
    },
    /// Histories have no merge base.
    #[error("[mokly-git/base] histories have no merge base")]
    NoMergeBase,
    /// The base contains no regular file at the requested path.
    #[error("[mokly-git/read] no regular blob at {path}")]
    MissingBlob {
        /// Requested repository-relative path.
        path: String,
    },
    /// A symbolic link or submodule cannot supply source bytes.
    #[error("[mokly-git/read] {path} is not a regular file")]
    NotRegular {
        /// Rejected repository-relative path.
        path: String,
    },
    /// A bounded tree has too many leaves.
    #[error("[mokly-git/read] tree exceeds {limit} files")]
    FileCount {
        /// Maximum leaf count.
        limit: usize,
    },
    /// A tree metadata listing exceeded its independent node count.
    #[error("[mokly-git/tree] tree exceeds its {limit}-node bound")]
    NodeCount {
        /// Maximum metadata entries.
        limit: usize,
    },
    /// One source object cannot fit its byte or framed batch budget.
    #[error("[mokly-git/read] {path}: source bytes exceed {limit} bytes")]
    BlobLimit {
        /// Exact repository-relative file.
        path: String,
        /// Maximum byte budget.
        limit: usize,
    },
    /// A blob or archive exceeds its byte budget.
    #[error("[mokly-git/read] source bytes exceed {limit} bytes")]
    ByteLimit {
        /// Maximum uncompressed bytes.
        limit: usize,
    },
    /// Cancellation completed after all owned pipes closed.
    #[error("[mokly-git/command] command cancelled")]
    Cancelled,
    /// Stdin exceeds the command input bound.
    #[error("[mokly-git/command] input exceeds {limit} bytes")]
    InputLimit {
        /// Maximum input bytes.
        limit: usize,
    },
    /// A request exceeds the maximum capture budget before Git starts.
    #[error("[mokly-git/command] output limit {limit} exceeds {maximum} bytes per stream")]
    InvalidOutputLimit {
        /// Rejected per-stream capture budget.
        limit: usize,
        /// Maximum supported per-stream budget.
        maximum: usize,
    },
    /// Git exited unsuccessfully; stderr remains bounded binary data.
    #[error("[mokly-git/command] Git exited with status {status:?}")]
    CommandFailed {
        /// Child exit status, absent after a signal.
        status: Option<i32>,
        /// Captured safe-to-inspect stderr bytes.
        stderr: Vec<u8>,
    },
    /// A checkout conversion command exceeded its bounded filter deadline.
    #[error("[mokly-git/checkout] checkout filter reached its time limit")]
    CheckoutTimeout,
    /// A failed conversion leaves this exact historical path unavailable.
    #[error("[mokly-git/checkout] {path}: {source}")]
    Conversion {
        /// Repository path that did not convert.
        path: String,
        /// Original bounded command or conversion failure.
        source: Box<Error>,
    },
    /// A checkout filter returned a failure diagnostic.
    #[error("[mokly-git/checkout] checkout filter failed")]
    CheckoutFailed {
        /// Bounded filter diagnostic.
        stderr: Vec<u8>,
    },
    /// A promisor object fetch failed before checkout conversion.
    #[error(
        "[mokly-git/fetch] Git fetch {remote} failed; run `git fetch {remote} {object}` to recover the base objects"
    )]
    FetchFailed {
        remote: String,
        object: String,
        /// Original fetch failure.
        source: Box<Error>,
    },
    /// A required object is absent and no promisor remote is configured.
    #[error("[mokly-git/fetch] base object {object} is missing; run `git fetch origin {object}`")]
    MissingObject { object: String },
    /// A command exceeded its capture bound.
    #[error("[mokly-git/command] output exceeds {limit} bytes per stream")]
    OutputLimit {
        /// Configured capture bound.
        limit: usize,
    },
    /// One argument cannot fit the bounded invocation.
    #[error("[mokly-git/batches] argument exceeds the {limit}-byte batch budget")]
    ArgumentLimit {
        /// Maximum argument budget.
        limit: usize,
    },
    /// A batch budget cannot hold any arguments.
    #[error("[mokly-git/batches] argument count and byte budgets must be positive")]
    InvalidBudget,
    /// An injected platform boundary failed.
    #[error("[mokly-git/platform] {source}")]
    Platform {
        /// Typed source failure.
        source: error::Error,
    },
    /// Adapter implementation failed.
    #[error("[mokly-git/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Original internal source failures.
#[derive(Debug, Error)]
pub enum InternalError {
    /// Starting or communicating with Git failed.
    #[error("Git I/O failed: {source}")]
    Io {
        /// Original I/O error.
        source: io::Error,
    },
    /// A capture worker did not complete.
    #[error("Git capture worker failed")]
    Worker,
}

/// Preserve I/O source types at adapter boundaries.
pub(crate) trait IoResult<T> {
    /// Promote an I/O result to the Git error contract.
    fn git(self) -> Result<T>;
}

impl<T> IoResult<T> for io::Result<T> {
    #[track_caller]
    fn git(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::Internal(InternalError::Io { source })),
        }
    }
}

impl Error {
    /// Whether a bounded operation ran out of its configured capacity.
    pub fn is_limit(&self) -> bool {
        matches!(
            self,
            Self::FileCount { .. }
                | Self::NodeCount { .. }
                | Self::ByteLimit { .. }
                | Self::BlobLimit { .. }
                | Self::InputLimit { .. }
                | Self::OutputLimit { .. }
                | Self::ArgumentLimit { .. }
        )
    }
}
