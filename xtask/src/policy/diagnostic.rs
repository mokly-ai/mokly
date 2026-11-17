//! Typed, actionable file validation failures.

use std::path::PathBuf;

use thiserror::Error;

/// A specific repository contract violation.
#[derive(Debug, Error, PartialEq, Eq)]
pub(crate) enum Violation {
    /// MIT source depends on cloud source through a manifest or an import.
    #[error("[xtask/boundary] {path}: depends on AGPL source {dependency}")]
    CloudDependency { path: PathBuf, dependency: String },
    #[error(
        "[xtask/diagnostic] invalid GitHub subscription list in docs/protocol/cloud/github-app.md"
    )]
    GitHubSubscriptions,
    #[error("[xtask/diagnostic] missing GitHub delivery fixture for subscribed event: {0}")]
    GitHubDeliveryFixture(String),
    #[error("[xtask/diagnostic] invalid OpenAPI reason: {0}")]
    OpenapiReason(String),
    #[error(
        "[xtask/diagnostic] implemented OpenAPI operation {operation} declares reserved reason {reason}"
    )]
    OpenapiReservedReason { operation: String, reason: String },
    #[error("[xtask/diagnostic] {path}:{line}: trailing whitespace")]
    TrailingWhitespace { path: PathBuf, line: usize },
    #[error("[xtask/diagnostic] {0}: missing final newline")]
    FinalNewline(PathBuf),
    #[error("[xtask/diagnostic] {0}: blank line at end of file")]
    FinalBlankLine(PathBuf),
    #[error("[xtask/diagnostic] {0}: missing toolchain version row")]
    MissingPin(String),
    #[error("[xtask/diagnostic] {path}: {field} must be {expected}, found {actual}")]
    PinMismatch {
        path: PathBuf,
        field: String,
        expected: String,
        actual: String,
    },
    #[error("[xtask/diagnostic] migration lock line {0}: invalid entry")]
    InvalidLock(usize),
    #[error("[xtask/diagnostic] migration lock entries must be unique and sorted")]
    LockOrder,
    #[error("[xtask/diagnostic] {0}: locked migration was changed or removed")]
    ChangedMigration(PathBuf),
    #[error("[xtask/diagnostic] {0}: migration SQL file has no lock entry")]
    UnlockedMigration(PathBuf),
    #[error("[xtask/diagnostic] {0}: invalid migration directory or SQL pair")]
    MigrationLayout(PathBuf),
    #[error("[xtask/diagnostic] {0}: migration lock differs from origin/main")]
    ChangedBaseline(PathBuf),
    #[error(
        "[xtask/diagnostic] {path}:{line}: generated API artifact drift: expected {expected}, found {actual}"
    )]
    GeneratedDrift {
        path: PathBuf,
        line: usize,
        expected: String,
        actual: String,
    },
}
