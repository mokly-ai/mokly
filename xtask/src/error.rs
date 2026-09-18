//! Typed failures produced by repository automation.

use std::io;

use thiserror::Error;

use crate::check::VerificationSuite;

/// Result returned by xtask operations.
pub(crate) type Result<T> = std::result::Result<T, Error>;

/// Failures surfaced by xtask commands.
#[derive(Debug, Error)]
pub(crate) enum Error {
    /// A shard did not use the required one-based `INDEX/TOTAL` form.
    #[error(
        "[xtask/check] invalid shard `{shard}`; expected one-based INDEX/TOTAL within JavaScript safe integers"
    )]
    InvalidShard {
        /// Rejected argument.
        shard: String,
    },
    /// Sharding was requested without selecting a suite.
    #[error("[xtask/check] --shard requires --suite unit or --suite browser")]
    ShardRequiresSuite,
    /// Sharding was requested for an unsupported suite.
    #[error("[xtask/check] --shard is not supported with suite {suite}")]
    UnsupportedShard {
        /// Selected unsupported suite.
        suite: VerificationSuite,
    },
    /// The workspace root could not be derived from the crate manifest.
    #[error("[xtask/root] could not resolve the workspace root")]
    WorkspaceRoot,
    /// A subprocess could not be started.
    #[error("[xtask/command] could not start `{command}`: {source}")]
    CommandStart {
        /// Human-readable command.
        command: String,
        /// Originating operating-system error.
        source: io::Error,
    },
    /// A subprocess returned a non-success status.
    #[error("[xtask/command] `{command}` failed with status {status}")]
    CommandFailed {
        /// Human-readable command.
        command: String,
        /// Exit code or signal description.
        status: String,
    },
    /// A filesystem operation used by a repository audit failed.
    #[error("[xtask/filesystem] {operation} `{path}` failed: {source}")]
    Filesystem {
        /// Operation being attempted.
        operation: &'static str,
        /// Affected path.
        path: String,
        /// Originating operating-system error.
        source: io::Error,
    },
    /// Rust files exceeded the workspace line limit.
    #[error("[xtask/rust-file-length] files exceed 300 lines:\n{details}")]
    RustFileLength {
        /// Sorted violation report.
        details: String,
    },
}

/// Add typed context to filesystem results without obscuring call sites.
pub(crate) trait FilesystemResult<T> {
    /// Convert an I/O failure into the workspace filesystem contract.
    fn with_filesystem_context(self, operation: &'static str, path: &str) -> Result<T>;
}

impl<T> FilesystemResult<T> for io::Result<T> {
    #[track_caller]
    fn with_filesystem_context(self, operation: &'static str, path: &str) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::Filesystem {
                operation,
                path: path.to_owned(),
                source,
            }),
        }
    }
}
