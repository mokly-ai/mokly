//! Catalogue error categories. Expected source diagnostics are structured data.

use thiserror::Error;

use crate::diagnostic::{Issue, Warning};

/// Catalogue operation result.
pub type Result<T> = std::result::Result<T, CatalogueError>;

/// Errors callers classify before choosing their terminal presentation.
#[derive(Debug, Error)]
pub enum CatalogueError {
    /// No default configuration exists in any searched directory.
    #[error("[mokly-catalogue/config-missing] no mokly.config.json found; searched: {}", .searched.join(", "))]
    ConfigMissing {
        /// Searched directories, nearest first.
        searched: Vec<String>,
    },
    /// Invalid or unreadable configuration or root discovery.
    #[error("[mokly-catalogue/config-invalid] {}", .0.message)]
    Config(Issue),
    /// Authored catalogue failed validation; warnings produced so far are retained.
    #[error("[mokly-catalogue/build-invalid] catalogue validation failed")]
    Invalid {
        /// Root-cause validation issues in deterministic order.
        issues: Vec<Issue>,
        /// Warnings raised before the failure.
        warnings: Vec<Warning>,
    },
    /// An unhandled serialization failure retains its source.
    #[error("[mokly-catalogue/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Typed internal failures, without stringified wrappers.
#[derive(Debug, Error)]
pub enum InternalError {
    /// An injected runtime adapter failed.
    #[error("runtime adapter failed: {source}")]
    Provider {
        /// Original typed provider failure.
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    /// Data encoding failed.
    #[error("JSON encoding failed: {source}")]
    Json {
        /// Original JSON error.
        source: serde_json::Error,
    },
}
