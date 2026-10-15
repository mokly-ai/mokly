//! Expected runtime failures cross subsystem boundaries without display wrappers.

use thiserror::Error;

/// Stable runtime failure category retained by catalogue, CSS, and graph adapters.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeCode {
    /// Consumer configuration failed.
    Configuration,
    /// A build-time input or ownership contract failed.
    Build,
    /// Consumer bundling or evaluation failed.
    Bundle,
    /// Consumer rendering failed.
    Render,
    /// A consumer request exceeded its deadline.
    Timeout,
    /// A required executable or package entry is absent.
    Unavailable,
    /// The sidecar reports a different package version.
    Version,
    /// The sidecar violated the framed protocol.
    Protocol,
    /// The command was cancelled.
    Cancelled,
}

/// One typed expected failure with its complete authored diagnostic text.
#[derive(Clone, Debug, Error, Eq, PartialEq)]
#[error("[mokly-model/runtime] {message}")]
pub struct RuntimeDiagnostic {
    /// Category used to select terminal presentation without parsing text.
    pub code: RuntimeCode,
    /// Protocol text without internal crate prefixes.
    pub message: String,
}
