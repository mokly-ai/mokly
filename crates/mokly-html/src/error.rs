//! Typed composition failures with authoring diagnostics.

use std::result;

use mokly_catalogue::diagnostic::Warning;
use mokly_model::catalogue::SourceLocation;
use mokly_model::error::ModelError;
use mokly_model::runtime_diagnostic::RuntimeDiagnostic;
use thiserror::Error;

use crate::diagnostic_code::Code;

/// Composition result.
pub type Result<T> = result::Result<T, HtmlError>;

/// A failed document never enters the render cache.
#[derive(Debug, Error)]
pub enum HtmlError {
    /// Expected consumer runtime failure with its terminal category intact.
    #[error("[mokly-html/runtime] {source}")]
    Runtime {
        /// Typed consumer diagnostic, without internal display wrappers.
        source: RuntimeDiagnostic,
    },
    /// A document-scoped failure from final link or control validation.
    #[error("[mokly-html] {route}: {source}")]
    Route {
        /// Portable referring route.
        route: String,
        /// Original typed failure.
        source: Box<HtmlError>,
    },
    /// Composition diagnostics survive a later failure.
    #[error("[mokly-html/build-invalid] {source}")]
    Attempt {
        /// Original typed failure.
        source: Box<HtmlError>,
        /// Warnings already produced by the failed render.
        warnings: Vec<Warning>,
    },
    /// A render failure at one authored invocation.
    #[error("[mokly-html] {}:{}:{}: {source}", .location.path, .location.line, .location.column)]
    Located {
        /// Invocation coordinate, never an absolute path.
        location: SourceLocation,
        /// Original typed render failure.
        source: Box<HtmlError>,
    },
    /// Source-attributed authoring failure.
    #[error("[mokly-html/{code}] {message}")]
    Invalid {
        /// Stable authoring code.
        code: Code,
        /// Exact actionable detail.
        message: String,
        /// Invocation or source location.
        location: Option<SourceLocation>,
    },
    /// Props violate the shared schema contract.
    #[error("[mokly-html/props] {source}")]
    Props {
        /// Shared validation failure.
        source: ModelError,
    },
    /// A JavaScript render requires the sidecar implementation.
    #[error("[mokly-html/render-failed] JavaScript rendering is unavailable for {handle}")]
    FragmentUnavailable {
        /// Definition handle.
        handle: String,
    },
    /// An internal encoding failure retains its source.
    #[error("[mokly-html/internal] {0}")]
    Internal(#[from] InternalError),
}

impl HtmlError {
    /// Expected runtime diagnostic beneath location and warning wrappers.
    pub fn runtime_diagnostic(&self) -> Option<&RuntimeDiagnostic> {
        match self {
            Self::Runtime { source } => Some(source),
            Self::Located { source, .. }
            | Self::Attempt { source, .. }
            | Self::Route { source, .. } => source.runtime_diagnostic(),
            _ => None,
        }
    }

    /// The nearest known authored coordinate, independent of wrapper errors.
    pub fn location(&self) -> Option<&SourceLocation> {
        match self {
            Self::Located { location, .. }
            | Self::Invalid {
                location: Some(location),
                ..
            } => Some(location),
            Self::Attempt { source, .. } | Self::Route { source, .. } => source.location(),
            _ => None,
        }
    }

    /// Attach one coordinate without adding duplicate source locations.
    pub fn at(self, location: SourceLocation) -> Self {
        if self.location().is_some() || self.runtime_diagnostic().is_some() {
            self
        } else {
            Self::Located {
                location,
                source: Box::new(self),
            }
        }
    }

    /// Retain composition warnings for the invocation's terminal report.
    pub fn warnings(&self) -> Vec<Warning> {
        match self {
            Self::Attempt { warnings, .. } => warnings.clone(),
            Self::Located { source, .. } | Self::Route { source, .. } => source.warnings(),
            _ => Vec::new(),
        }
    }
}

/// Internal failures without stringified source wrappers.
#[derive(Debug, Error)]
pub enum InternalError {
    /// An injected runtime adapter failed.
    #[error("runtime adapter failed: {source}")]
    Provider {
        /// Original typed provider failure.
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    /// Model data could not be encoded.
    #[error("JSON encoding failed: {source}")]
    Json {
        /// Original JSON failure.
        source: serde_json::Error,
    },
}

pub(crate) fn invalid(code: Code, message: impl Into<String>) -> HtmlError {
    HtmlError::Invalid {
        code,
        message: message.into(),
        location: None,
    }
}

pub(crate) fn json<T: serde::Serialize>(value: &T) -> Result<serde_json::Value> {
    match serde_json::to_value(value) {
        Ok(value) => Ok(value),
        Err(source) => Err(InternalError::Json { source }.into()),
    }
}
