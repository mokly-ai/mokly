//! Typed adapter failures preserve their subsystem sources.

use mokly_css::error::CssError;
use mokly_sidecar::error::Error;
use mokly_source_interface::error::SourceError;
use thiserror::Error;

/// Integration operation result.
pub type Result<T> = std::result::Result<T, RenderError>;

/// Failures which invalidate a candidate without a fallback render.
#[derive(Debug, Error)]
pub enum RenderError {
    /// A consumer plugin bypassed a nested renderer exclusion.
    #[error(
        "[mokly-render/build-invalid] PostCSS plugin {plugin} reached renderer-owned CSS in {stylesheet}: {excluded} via {intermediate}; import it only from the renderer, import it directly so Mokly can prune it, or use Tailwind @reference"
    )]
    NestedImport {
        /// Reporting plugin.
        plugin: String,
        /// Processed root.
        stylesheet: String,
        /// Renderer-owned file that the plugin reached.
        excluded: String,
        /// Kept intermediate file with the excluded import.
        intermediate: String,
    },
    /// Invalid declared stylesheet path or suffix.
    #[error(
        "[mokly-render/build-invalid] component {component} declares invalid stylesheet {path}"
    )]
    StylesheetPath {
        /// Registered component parent.
        component: String,
        /// Authored declaration.
        path: String,
    },
    /// A declaration names a private or non-public file.
    #[error("[mokly-render/build-invalid] component {component} stylesheet {path}: {source}")]
    StylesheetPolicy {
        /// Registered component parent.
        component: String,
        /// Authored declaration.
        path: String,
        /// Public-file policy cause.
        source: mokly_graph::public_denial::PublicDenial,
    },
    /// Graph policy setup failed before rendering.
    #[error("[mokly-render] {source}")]
    Graph {
        /// Original graph error.
        source: Box<mokly_graph::error::GraphError>,
    },
    /// Sidecar launch, protocol, timeout, or consumer execution failure.
    #[error("[mokly-render] {source}")]
    Sidecar {
        /// Original fail-closed error.
        source: Error,
    },
    /// A stylesheet could not be prepared before JavaScript evaluation.
    #[error("[mokly-render] {source}")]
    Css {
        /// Original stylesheet error.
        source: CssError,
    },
    /// Invalid PostCSS dependency report.
    #[error("[mokly-render/build-invalid] {}", .reason.message(.plugin, .stylesheet, .path))]
    Dependency {
        /// Stylesheet whose transform reported the dependency.
        stylesheet: String,
        /// Plugin that reported the input.
        plugin: String,
        /// Repository-relative input.
        path: String,
        /// Stable dependency rule.
        reason: DependencyFailure,
    },
    /// A typed response did not match the pending operation.
    #[error("[mokly-render/sidecar-protocol] unexpected result for {method}")]
    ResultKind {
        /// Expected method.
        method: &'static str,
    },
    /// Render drafts disagree on a repeated logical input.
    #[error("[mokly-render/build-invalid] conflicting fragment input {key}")]
    Input {
        /// Instance or receiving-slot key.
        key: String,
    },
    /// An unhandled data or source error.
    #[error("[mokly-render/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Dependency inventory failures, independent of diagnostic strings.
#[derive(Debug, Error)]
pub enum DependencyFailure {
    /// An exact dependency is absent or is not a confined file.
    #[error("PostCSS dependency must be a regular file inside repoRoot")]
    File,
    /// A directory dependency is absent or has the wrong type.
    #[error("PostCSS directory dependency must be a directory inside repoRoot")]
    Directory,
    /// Invalid directory glob.
    #[error("invalid PostCSS directory dependency glob")]
    Glob,
}

/// Infrastructure errors retain their original type.
#[derive(Debug, Error)]
pub enum InternalError {
    /// JSON transport conversion failed.
    #[error("JSON conversion failed: {source}")]
    Json {
        /// Original JSON failure.
        source: serde_json::Error,
    },
    /// Source access failed.
    #[error("source read failed: {source}")]
    Source {
        /// Original source failure.
        source: SourceError,
    },
}

pub(crate) fn convert<T: serde::Serialize, U: serde::de::DeserializeOwned>(value: &T) -> Result<U> {
    let value = match serde_json::to_value(value) {
        Ok(value) => value,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    match serde_json::from_value(value) {
        Ok(value) => Ok(value),
        Err(source) => Err(InternalError::Json { source }.into()),
    }
}

impl DependencyFailure {
    pub(crate) fn message(&self, plugin: &str, stylesheet: &str, path: &str) -> String {
        match self {
            Self::File => format!(
                "PostCSS plugin {plugin} reported a missing dependency for {stylesheet}: {path}; make it a regular file or correct the plugin"
            ),
            Self::Directory => format!(
                "PostCSS plugin {plugin} reported a missing directory dependency for {stylesheet}: {path}; create the directory or correct the plugin"
            ),
            Self::Glob => format!(
                "PostCSS plugin {plugin} reported an invalid dependency for {stylesheet}; report a file or directory path and optional glob"
            ),
        }
    }
}
