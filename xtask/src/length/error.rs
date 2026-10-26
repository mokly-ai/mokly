//! Typed failures of the length audits and the protocol cap ratchet.

use std::io;

use thiserror::Error;

/// Result returned by the length audits.
pub(crate) type Result<T> = std::result::Result<T, Error>;

/// Failures of the length policy, its cap tables, and its Git comparison.
#[derive(Debug, Error)]
pub(crate) enum Error {
    /// The cap table is not valid JSON.
    #[error("[xtask/length] {label} is not valid JSON: {source}")]
    CapTableJson {
        /// The table's file label.
        label: String,
        /// The parser failure.
        source: serde_json::Error,
    },
    /// The cap table is valid JSON but not one object.
    #[error("[xtask/length] {label} must contain one JSON object")]
    CapTableShape {
        /// The table's file label.
        label: String,
    },
    /// A cap table key is not a clean Markdown path below `docs/protocol`.
    #[error(
        "[xtask/length] {label} has a key that is not a Markdown path relative to docs/protocol: {name}"
    )]
    CapTableKey {
        /// The table's file label.
        label: String,
        /// The rejected key.
        name: String,
    },
    /// A cap table names one document twice.
    #[error("[xtask/length] {label} repeats the cap for {name}")]
    CapTableRepeat {
        /// The table's file label.
        label: String,
        /// The repeated document.
        name: String,
    },
    /// The cap table keys are not in ascending UTF-16 code unit order.
    #[error("[xtask/length] {label} keys are not sorted: {name} follows {previous}")]
    CapTableOrder {
        /// The table's file label.
        label: String,
        /// The key out of order.
        name: String,
        /// The key before it.
        previous: String,
    },
    /// A cap is not a safe integer above 250.
    #[error("[xtask/length] {label} has an invalid cap for {name}; use a safe integer above 250")]
    CapTableValue {
        /// The table's file label.
        label: String,
        /// The capped document.
        name: String,
    },
    /// The working tree has no cap table.
    #[error("[xtask/length] {label} is missing")]
    CapTableMissing {
        /// The table's file label.
        label: String,
    },
    /// The legacy test's `oversizedCaps` is not an object literal.
    #[error("[xtask/length] {label} has an invalid oversizedCaps table")]
    LegacyTable {
        /// The legacy test's label at the comparison commit.
        label: String,
    },
    /// A legacy entry is not a string key with a numeric literal value.
    #[error("[xtask/length] {label} has a non-literal oversizedCaps entry")]
    LegacyEntry {
        /// The legacy test's label at the comparison commit.
        label: String,
    },
    /// A legacy cap is not a safe integer above 250.
    #[error("[xtask/length] {label} has an invalid cap for {name}")]
    LegacyValue {
        /// The legacy test's label at the comparison commit.
        label: String,
        /// The capped document.
        name: String,
    },
    /// The legacy test at the comparison commit declares no `oversizedCaps`.
    #[error("[xtask/length] {label} has no oversizedCaps table")]
    LegacyMissing {
        /// The legacy test's label at the comparison commit.
        label: String,
    },
    /// A Git command could not start.
    #[error("[xtask/length] could not start `{command}`: {source}")]
    GitStart {
        /// The Git command.
        command: String,
        /// The operating-system failure.
        source: io::Error,
    },
    /// A Git command exited unsuccessfully.
    #[error("[xtask/length] repository ratchet command failed: {command}: {stderr}")]
    GitCommand {
        /// The Git command.
        command: String,
        /// Git's standard error.
        stderr: String,
    },
    /// `origin/main` moved while a merge of it was in progress.
    #[error("[xtask/length] origin/main moved during the merge; fetch and merge it again")]
    TargetMoved,
    /// Git returned no merge base.
    #[error("[xtask/length] could not resolve the merge base of HEAD and origin/main")]
    MissingBase,
    /// A working-tree read failed.
    #[error("[xtask/length] {operation} `{path}` failed: {source}")]
    Filesystem {
        /// The attempted operation.
        operation: &'static str,
        /// The affected path.
        path: String,
        /// The operating-system failure.
        source: io::Error,
    },
    /// Changed source or protocol files exceed their limits.
    #[error("[xtask/length] Source file-length audit failed:\n{details}")]
    SourceFileLength {
        /// One finding per line.
        details: String,
    },
    /// The protocol cap ratchet reported findings.
    #[error("[xtask/length] the protocol document cap ratchet failed")]
    ProtocolCaps,
}
