//! Model error contract.

use serde_json::Error;
use thiserror::Error;

use crate::diagnostic::Diagnostic;

/// Model operation result.
pub type Result<T> = std::result::Result<T, ModelError>;

/// Failures that callers can classify without parsing text.
#[derive(Debug, Error)]
pub enum ModelError {
    /// An authored schema violates the supported profile.
    #[error("[mokly-model/schema] {0}")]
    Schema(Diagnostic),
    /// Props violate the schema or the plain-data limits.
    #[error("[mokly-model/props] {0}")]
    Props(Diagnostic),
    /// A serialization implementation failed.
    #[error("[mokly-model/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Internal failures retain their original source type.
#[derive(Debug, Error)]
pub enum InternalError {
    /// JSON serialization failed.
    #[error("JSON serialization failed: {source}")]
    Json {
        /// Original JSON error.
        source: Error,
    },
}
