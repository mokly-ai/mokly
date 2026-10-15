//! Render graph errors preserve failures from each subsystem.

use std::result;

use mokly_catalogue::diagnostic::Warning;
use mokly_css::error::CssError;
use mokly_html::error::HtmlError;
use thiserror::Error;

/// Render graph result.
pub type Result<T> = result::Result<T, GraphError>;

/// A failed candidate cannot be published or written.
#[derive(Debug, Error)]
pub enum GraphError {
    /// All failed workers and warnings are retained in authored route order.
    #[error("[mokly-graph/build-invalid] {}", .failures.iter().map(ToString::to_string).collect::<Vec<_>>().join("\n"))]
    Attempt {
        /// Original typed failures, in deterministic order.
        failures: Vec<GraphError>,
        /// Diagnostics produced before the attempt failed.
        warnings: Vec<Warning>,
    },
    /// Source or resource policy failed.
    #[error("[mokly-graph/build-invalid] {message}")]
    Invalid {
        /// Source route or path.
        route: String,
        /// Complete user-facing diagnostic.
        message: String,
    },
    /// HTML composition failed.
    #[error("[mokly-graph/build-invalid] {source}")]
    Html {
        /// Original composition failure.
        source: HtmlError,
    },
    /// Stylesheet handling failed.
    #[error("[mokly-graph/build-invalid] {source}")]
    Css {
        /// Original stylesheet failure.
        source: CssError,
    },
    /// Internal infrastructure failed.
    #[error("[mokly-graph/internal] {0}")]
    Internal(#[from] InternalError),
}

impl GraphError {
    /// All warnings that must print before this failure.
    pub fn warnings(&self) -> Vec<Warning> {
        match self {
            Self::Attempt { failures, warnings } => {
                let mut result = warnings.clone();
                for failure in failures {
                    result.extend(failure.warnings());
                }
                result
            }
            Self::Html { source } => source.warnings(),
            _ => Vec::new(),
        }
    }
}

/// Internal failures retain their error type.
#[derive(Debug, Error)]
pub enum InternalError {
    /// Canonical key input serialization failed.
    #[error("key serialization failed: {source}")]
    Json {
        /// Original JSON failure.
        source: serde_json::Error,
    },
    /// Worker creation failed.
    #[error("render workers could not start: {source}")]
    Workers {
        /// Original worker failure.
        source: rayon::ThreadPoolBuildError,
    },
}

pub(crate) fn invalid(route: &str, message: impl Into<String>) -> GraphError {
    GraphError::Invalid {
        route: route.into(),
        message: message.into(),
    }
}
