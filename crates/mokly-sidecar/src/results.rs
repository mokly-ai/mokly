//! Typed result payloads and diagnostic records.

use serde::{Deserialize, Serialize};

/// Package version reported during hello.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Hello {
    /// Exact sidecar npm package version.
    pub version: String,
}

/// A module's ordered import edges.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Module {
    /// Repository-relative source path.
    pub path: String,
    /// Resolved logical paths in source order.
    pub imports: Vec<String>,
}

/// A sidecar warning before catalogue attribution.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Warning {
    /// Stable build warning code.
    pub code: String,
    /// Safe diagnostic detail.
    pub message: String,
}

/// An unevaluated bundle's module graph.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Bundle {
    /// Content-addressed bundle id.
    pub generation: String,
    /// Complete module graph.
    pub modules: Vec<Module>,
    /// Nonfatal bundling diagnostics.
    pub warnings: Vec<Warning>,
}

/// Rendered fragment and its declared resources.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Render {
    /// Rendered HTML fragment.
    pub html: String,
    /// CSS rules in first-appearance order.
    pub styles: Vec<String>,
    /// Repository-relative non-CSS public resource seeds.
    pub resources: Vec<String>,
    /// Nonfatal render diagnostics.
    pub warnings: Vec<Warning>,
}

/// Complete page document; the core applies the document safety rules.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Page {
    /// Complete synchronous page HTML.
    pub html: String,
    /// Declared public resource seeds.
    pub resources: Vec<String>,
    /// Nonfatal render diagnostics.
    pub warnings: Vec<Warning>,
}

/// PostCSS dependency kind used by the watcher.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DependencyKind {
    /// One source file.
    File,
    /// A directory dependency.
    Directory,
}

/// A file or directory reported by consumer PostCSS.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Dependency {
    /// Dependency kind.
    pub kind: DependencyKind,
    /// Source path.
    pub path: String,
}

/// Consumer PostCSS result.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Css {
    /// Transformed stylesheet text.
    pub text: String,
    /// Watch dependencies.
    pub dependencies: Vec<Dependency>,
}
