//! Typed result payloads and diagnostic records.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::compiled::CompiledGeneration;
use crate::postcss_evidence::Evidence;
use crate::render_records::{CollectedStyle, MarkerDraft};
use crate::usage::{InstanceDraft, SlotDraft};

/// Package version reported during hello.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "HelloResult")]
pub struct Hello {
    /// Exact sidecar npm package version.
    pub version: String,
}

/// A module's ordered import edges.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Module {
    /// Digest of the bytes that the bundler actually consumed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub digest: Option<String>,
    /// Repository-relative source path.
    pub path: String,
    /// Resolved logical paths in source order.
    pub imports: Vec<String>,
}

/// A sidecar warning before catalogue attribution.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Warning {
    /// Stable build warning code.
    pub code: WarningCode,
    /// Safe diagnostic detail.
    pub message: String,
}

/// An unevaluated bundle's module graph.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "BundleResult")]
pub struct Bundle {
    /// Used repository dependency directories whose importer lookup is not mapped.
    #[serde(
        default,
        rename = "unmappedDependencyDirectories",
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub unmapped_dependency_directories: Option<Vec<String>>,
    /// Pool-owned lifetime epoch; never crosses the wire.
    #[serde(skip)]
    #[ts(skip)]
    pub epoch: u64,
    /// Immutable code for restoration and evaluation-only reuse.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub compiled: Option<CompiledGeneration>,
    /// Content-addressed bundle id.
    pub generation: String,
    /// Complete module graph.
    pub modules: Vec<Module>,
    /// Nonfatal bundling diagnostics.
    pub warnings: Vec<Warning>,
}

/// Rendered fragment and its declared resources.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "RenderResult")]
pub struct Render {
    /// Rendered HTML fragment.
    pub html: String,
    /// CSS rules in first-appearance order.
    pub styles: Vec<CollectedStyle>,
    /// Authenticated operations and physical enclosing markers.
    pub markers: Vec<MarkerDraft>,
    /// Repository-relative non-CSS public resource seeds.
    pub resources: Vec<String>,
    /// Instance placements for core validation and usage construction.
    pub instances: Vec<InstanceDraft>,
    /// Supplied slots and their physical placements.
    pub slots: Vec<SlotDraft>,
    /// Nonfatal render diagnostics.
    pub warnings: Vec<Warning>,
}

/// Complete page document; the core applies the document safety rules.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "PageResult")]
pub struct Page {
    /// Complete synchronous page HTML.
    pub html: String,
    /// Declared public resource seeds.
    pub resources: Vec<String>,
    /// Nonfatal render diagnostics.
    pub warnings: Vec<Warning>,
}

/// PostCSS dependency kind used by the watcher.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum DependencyKind {
    /// One source file.
    File,
    /// A directory dependency.
    Directory,
}

/// A file or directory reported by consumer PostCSS.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Dependency {
    /// Dependency kind.
    pub kind: DependencyKind,
    /// Source path.
    pub path: String,
    /// Plugin name used in dependency diagnostics.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub plugin: Option<String>,
    /// Directory-relative matching pattern, absent for an explicit file.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub glob: Option<String>,
}

/// Consumer PostCSS result.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "CssResult")]
pub struct Css {
    /// Context read witnesses, independent of plugin dependency declarations.
    #[serde(default, rename = "readEvidence")]
    pub read_evidence: Evidence,
    /// Used repository dependency directories whose importer lookup is not mapped.
    #[serde(
        default,
        rename = "unmappedDependencyDirectories",
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub unmapped_dependency_directories: Option<Vec<String>>,
    /// Transformed stylesheet text.
    pub text: String,
    /// Watch dependencies.
    pub dependencies: Vec<Dependency>,
}

/// Stable build warning categories.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum WarningCode {
    /// Base dependencies fell back to the working tree.
    BaseDependencies,
    /// A component declares a stylesheet more than once.
    DuplicateComponentStylesheet,
    /// HTML parsing moved an element out of a table.
    HtmlFosterParented,
    /// A body does not reference a declared prop.
    HtmlUnusedProps,
    /// A styled link has an overlapping ancestor.
    LinkControlAncestor,
    /// A styled link has an overlapping descendant.
    LinkControlDescendant,
    /// A marker occurred inside raw text.
    MarkerInRawText,
    /// Inference excluded a non-data prop.
    PropsNotData,
}
