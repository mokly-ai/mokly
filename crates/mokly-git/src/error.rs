//! Git runner error contract.

use std::io;

use mokly_platform::error;
use thiserror::Error;

/// Git operation result.
pub type Result<T> = std::result::Result<T, Error>;

/// Typed Git execution failures.
#[derive(Debug, Error)]
pub enum Error {
    /// This runner terminated Git in response to command cancellation.
    #[error("[mokly-git/cancelled] Git was cancelled")]
    Cancelled,
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
