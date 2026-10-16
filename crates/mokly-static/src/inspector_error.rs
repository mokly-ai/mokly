//! Typed inspector publication diagnostics, separated from output-path failures.

use thiserror::Error;

/// Inspector validation failure; the enclosing error always carries a document route.
#[derive(Debug, Error)]
pub enum InspectorFailure {
    /// Consumer-authored metadata cannot impersonate package boundary data.
    #[error("[mokly-static/inspector] {attribute} is reserved for Mokly.")]
    Reserved {
        /// Reserved attribute supplied by the author.
        attribute: &'static str,
    },
    /// The composition range record is inconsistent.
    #[error("[mokly-static/inspector] Inspector ranges are invalid.")]
    Ranges,
    /// The document has no place for the inert metadata and script.
    #[error("[mokly-static/inspector] The rendered document has no head.")]
    Head,
}
