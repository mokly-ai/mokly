//! Typed frame probe publication diagnostics, separated from output-path failures.

use thiserror::Error;

/// Frame probe validation failure; the enclosing error always carries a document route.
#[derive(Debug, Error)]
pub enum FrameProbeFailure {
    /// Consumer-authored metadata cannot impersonate package boundary data.
    #[error("[mokly-static/frame_probe] {attribute} is reserved for Mokly.")]
    Reserved {
        /// Reserved attribute supplied by the author.
        attribute: &'static str,
    },
    /// The document has no place for the inert metadata and script.
    #[error("[mokly-static/frame_probe] The rendered document has no head.")]
    Head,
}
