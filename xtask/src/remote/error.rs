//! Typed errors shared by remote verification boundaries.

use std::io;

use thiserror::Error;

use crate::remote::contracts::Output;

/// Remote verification result.
pub(crate) type Result<T> = std::result::Result<T, Error>;

/// Named side-effecting operations for diagnostics.
#[derive(Clone, Copy, Debug)]
pub(crate) enum Operation {
    /// Read local Git state.
    Git,
    /// Authenticate or manage a Testbox.
    Blacksmith,
    /// Cancel a GitHub workflow run.
    Github,
    /// Compute the source fingerprint.
    Fingerprint,
    /// Validate downloaded reports.
    Aggregate,
    /// Open or write verification logs.
    Logs,
    /// Inspect an executable path.
    Program,
}

#[cfg(test)]
#[path = "_tests_/error_tests.rs"]
mod error_tests;

/// Failures that prevent a complete remote pass.
#[derive(Debug, Error)]
pub(crate) enum Error {
    /// A child did not expose its configured output pipe.
    #[error("[xtask/remote] child output pipe is unavailable")]
    Pipe,
    /// A synchronized runtime resource failed.
    #[error("[xtask/remote] {operation:?} resource lock is poisoned")]
    Poisoned {
        /// Resource responsibility.
        operation: Operation,
    },
    /// Invalid effective executor value.
    #[error("[xtask/executor] invalid executor `{value}`; use auto, local or remote")]
    InvalidExecutor {
        /// Rejected mode value.
        value: String,
    },
    /// Remote requests cannot select a partial suite.
    #[error("[xtask/executor] remote execution requires the complete gate; remove --suite")]
    SelectedSuite,
    /// Hosted workflows must use the local gate.
    #[error("[xtask/executor] remote execution is unavailable in GitHub Actions")]
    GithubActions,
    /// Required executable is absent.
    #[error("[xtask/executor] missing executable `{program}`; {hint}")]
    MissingProgram {
        /// Missing program name.
        program: &'static str,
        /// Installation instruction.
        hint: &'static str,
    },
    /// GitHub does not contain the local commit.
    #[error("[xtask/executor] local HEAD is not published; push the branch first")]
    UnpublishedHead,
    /// A system operation failed before returning an exit status.
    #[error("[xtask/remote] {operation:?} operation failed: {source}")]
    Io {
        /// Operation that failed.
        operation: Operation,
        /// Original system error.
        source: io::Error,
    },
    /// A command returned a failed or signal exit.
    #[error("[xtask/remote] {operation:?} command failed with {}", termination(*code))]
    Command {
        /// Command responsibility.
        operation: Operation,
        /// Numeric exit code, absent for a signal.
        code: Option<i32>,
    },
    /// Preserve both script streams alongside the original typed failure.
    #[error("[xtask/scripts] {source}")]
    Captured {
        /// Original command or identity error.
        source: Box<Error>,
        /// Captured stdout, stderr and termination status.
        output: Output,
    },
    /// Warmup output must identify exactly one box.
    #[error("[xtask/remote] warmup reported {count} box IDs; expected exactly one")]
    WarmupIds {
        /// Number of canonical identifier lines.
        count: usize,
    },
    /// Separate warmups must not assign the same box to several commands.
    #[error("[xtask/remote] warmups repeated box ID {id}")]
    RepeatedBox {
        /// Repeated identifier.
        id: String,
    },
    /// Preparation cannot fall back when a box stop still failed.
    #[error("[xtask/remote] preparation cleanup failed for {failures} stop attempts: {source}")]
    PreparationCleanup {
        /// Original preparation error.
        source: Box<Error>,
        /// Failed cleanup attempts.
        failures: usize,
    },
    /// Probe lines or local fingerprint output are invalid.
    #[error("[xtask/remote] invalid or different {field} output; expected {expected}")]
    Identity {
        /// Identity field being checked.
        field: &'static str,
        /// Required identity value.
        expected: String,
    },
    /// A worker panicked instead of producing a result.
    #[error("[xtask/remote] verification worker did not return a result")]
    Worker,
    /// The user interrupted the check.
    #[error("[xtask/remote] verification interrupted; boxes were stopped")]
    Interrupted,
    /// Signal handling could not be installed.
    #[error("[xtask/remote] could not install interrupt handler: {source}")]
    Signal {
        /// Original signal installation error.
        source: ctrlc::Error,
    },
    /// At least one complete-gate requirement failed.
    #[error(
        "[xtask/remote] verification failed: {commands} commands, {reports} downloads, aggregate-failed={aggregate_failed}, changed-tree={changed}, cleanup={cleanup}"
    )]
    Verification {
        /// Failed suite commands.
        commands: usize,
        /// Failed report downloads.
        reports: usize,
        /// Aggregate failure.
        aggregate_failed: bool,
        /// Local source tree changed.
        changed: bool,
        /// Failed box stops.
        cleanup: usize,
    },
}

/// Clear termination wording without Rust's Option debug notation.
fn termination(code: Option<i32>) -> String {
    match code {
        Some(code) => format!("exit {code}"),
        None => "a signal".to_owned(),
    }
}
