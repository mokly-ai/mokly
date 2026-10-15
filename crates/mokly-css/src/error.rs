//! Typed stylesheet failures and normative authored diagnostics.

use std::result;

use thiserror::Error;

/// CSS operation result.
pub type Result<T> = result::Result<T, CssError>;

/// Failures distinguish policy, transform, import, and asset errors.
#[derive(Debug, Error)]
pub enum CssError {
    /// The delivery root cannot form a portable route.
    #[error(
        "[mokly-css/build-invalid] cannot deliver imported CSS for {path}: the module path is not URL-safe; rename its file or directories (an entry path override does not change stylesheet routes)"
    )]
    RootRoute {
        /// Repository-relative root path.
        path: String,
    },
    /// A local import could not resolve under the source-tree policy.
    #[error(
        "[mokly-css/build-invalid] could not resolve CSS @import in {stylesheet}: {specifier}; use an existing stylesheet inside repoRoot"
    )]
    Import {
        /// Importing source.
        stylesheet: String,
        /// Authored import specifier.
        specifier: String,
    },
    /// An asset violates a normative delivery rule.
    #[error("[mokly-css/build-invalid] {message}")]
    Asset {
        /// Typed rule.
        kind: AssetFailure,
        /// Complete protocol diagnostic.
        message: String,
    },
    /// CSS could not be parsed, scoped, or printed.
    #[error("[mokly-css/build-invalid] {message}")]
    Transform {
        /// Typed transform failure.
        kind: TransformFailure,
        /// Complete protocol diagnostic.
        message: String,
    },
    /// A consumer PostCSS implementation must be supplied.
    #[error("[mokly-css/build-invalid] consumer PostCSS requires a sidecar: {module}")]
    PostcssUnavailable {
        /// Configured consumer module.
        module: String,
    },
}

/// Asset rejection categories, independent of message text.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum AssetFailure {
    /// Root-absolute URL.
    Absolute,
    /// Missing, escaping, symbolic-link, or non-file target.
    File,
    /// Unsupported asset extension.
    Extension,
    /// Non-portable route.
    Route,
    /// Quoted local image-set string.
    ImageSet,
}

/// Stylesheet rejection categories.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum TransformFailure {
    /// Parse or printer failure.
    Syntax,
    /// Local import after a style rule.
    LateImport,
    /// Unsupported CSS Modules construct.
    Modules,
    /// Generated local name collision.
    Collision,
}
