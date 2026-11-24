//! Typed result payloads and diagnostic records.

use std::collections::BTreeMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::bundle_outcomes::CacheOutcome;
use crate::compiled::CompiledGeneration;
use crate::postcss_evidence::Evidence;
use crate::render_records::{CollectedStyle, MarkerDraft};
use crate::resolution_plan::ResolutionPlan;
use crate::usage::{InstanceDraft, SlotDraft};

/// Package version reported during hello.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[ts(rename = "HelloResult")]
pub struct Hello {
    /// Exact sidecar npm package version.
    pub version: String,
}

/// A module's ordered import edges.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct Module {
    /// Digest of the bytes that the bundler actually consumed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub digest: Option<String>,
    /// This module used the asset-default loader.
    #[serde(
        default,
        rename = "importedAsset",
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub imported_asset: Option<bool>,
    /// Repository-relative source path.
    pub path: String,
    /// Resolved logical paths in source order.
    pub imports: Vec<String>,
}

/// An unevaluated bundle's module graph.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[ts(rename = "BundleResult")]
pub struct Bundle {
    /// Optional native plan paired with this compilation's reuse evidence.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub plan: Option<Arc<ResolutionPlan>>,
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
    /// Pool-owned cache classification; never crosses the wire.
    #[serde(skip)]
    #[ts(skip)]
    pub cache: Option<CacheOutcome>,
    /// Worker-observed esbuild operations for this request; never crosses the wire.
    #[serde(skip)]
    #[ts(skip)]
    pub compile_count: u64,
    /// Immutable code for restoration and evaluation-only reuse.
    pub compiled: Arc<CompiledGeneration>,
    /// Content-addressed bundle id.
    pub generation: String,
    /// Complete module graph.
    pub modules: Arc<Vec<Module>>,
}

/// Rendered fragment and its declared resources.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
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
}

/// Complete page document; the core applies the document safety rules.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[ts(rename = "PageResult")]
pub struct Page {
    /// Complete synchronous page HTML.
    pub html: String,
    /// Declared public resource seeds.
    pub resources: Vec<String>,
}

/// Inline stylesheet and file evidence from one Vite transform.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "ViteCssResult")]
pub struct ViteCss {
    /// Transformed CSS, before Mokly's asset rewriting and delivery.
    pub text: String,
    /// Vite's original local-to-scoped exports.
    pub class_map: BTreeMap<String, String>,
    /// Digest of the selected stylesheet bytes.
    pub source_digest: String,
    /// Files reached by this transform, including files read by `composes`.
    pub dependencies: BTreeMap<String, Option<String>>,
    /// Logical importers of dependencies that the resolver read without a report.
    pub imported_by: BTreeMap<String, String>,
    /// Setup and resolution inputs, including missing watch candidates.
    pub metadata_inputs: BTreeMap<String, Option<String>>,
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
