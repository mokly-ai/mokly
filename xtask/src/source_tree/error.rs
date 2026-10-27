//! Typed failures of the source-tree fingerprint.

use std::io;

use thiserror::Error;

/// Result returned by the source-tree fingerprint.
pub(crate) type Result<T> = std::result::Result<T, Error>;

/// Failures of the fingerprint value, its Git listings, and its file reads.
#[derive(Debug, Error)]
pub(crate) enum Error {
    /// The value is not `sha256:` and 64 lowercase hex digits.
    #[error("[xtask/source-tree] expected fingerprint must match sha256:<64 lowercase hex digits>")]
    Format,
    /// The index holds a submodule entry.
    #[error("[xtask/source-tree] source-tree fingerprint does not support submodule entries")]
    Submodule,
    /// A listed path is a nested repository, a worktree, or another type
    /// that the fingerprint cannot hash.
    #[error(
        "[xtask/source-tree] source-tree fingerprint found an unsupported file type at {}; ignore or remove a nested repository or worktree",
        quoted(path)
    )]
    UnsupportedType {
        /// The repository-relative path.
        path: String,
    },
    /// A Git path is not valid UTF-8 on a platform whose paths are text.
    #[cfg_attr(
        unix,
        expect(dead_code, reason = "Unix paths take the raw bytes of every Git path")
    )]
    #[error("[xtask/source-tree] Git path {} is not valid UTF-8", quoted(path))]
    PathEncoding {
        /// The repository-relative path with replacement characters.
        path: String,
    },
    /// Git could not start.
    #[error("[xtask/source-tree] could not start `{command}`: {source}")]
    GitStart {
        /// The Git command.
        command: String,
        /// The operating-system failure.
        source: io::Error,
    },
    /// Git exited unsuccessfully.
    #[error("[xtask/source-tree] `{command}` failed: {stderr}")]
    GitCommand {
        /// The Git command.
        command: String,
        /// Git's standard error.
        stderr: String,
    },
    /// A listed path could not be inspected or read.
    #[error("[xtask/source-tree] could not read {path}: {source}")]
    Read {
        /// The affected path.
        path: String,
        /// The operating-system failure.
        source: io::Error,
    },
    /// The fingerprint differs from the expected value.
    #[error(
        "[xtask/source-tree] source-tree fingerprint does not match: expected {expected}; actual {actual}"
    )]
    Mismatch {
        /// The fingerprint that the caller expected.
        expected: String,
        /// The fingerprint of the working tree.
        actual: String,
    },
    /// `git rev-parse HEAD` did not print one full lowercase SHA.
    #[error("[xtask/source-tree] expected a full lowercase HEAD SHA")]
    Head,
    /// Standard output could not take the result.
    #[error("[xtask/source-tree] could not write the fingerprint: {source}")]
    Output {
        /// The operating-system failure.
        source: io::Error,
    },
}

/// A path in JSON string quotes, as the Node fingerprint printed it.
fn quoted(path: &str) -> String {
    match serde_json::to_string(path) {
        Ok(quoted) => quoted,
        Err(_) => format!("{path:?}"),
    }
}
