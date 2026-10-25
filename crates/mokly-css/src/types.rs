//! Stylesheet delivery requests, results, and the consumer PostCSS boundary.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use mokly_source_interface::read_evidence::ReadEvidence;

use crate::dependencies::{DirectoryDependency, PluginInput};
use crate::error::Result;

/// One authored stylesheet or JavaScript module delivery root.
#[derive(Clone, Debug)]
pub struct StylesheetRoot {
    /// Repository-relative module or CSS path.
    pub path: String,
    /// Direct CSS inputs in first-reachability order.
    pub stylesheets: Vec<String>,
    /// Renderer-owned files pruned at every import depth.
    pub excluded: BTreeSet<String>,
    /// True for a local configured or component-declared stylesheet.
    pub local_css: bool,
}

/// Opaque resource identity; no payload is retained during stylesheet preparation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OpaqueAsset {
    /// Logical repository-relative input path.
    pub path: String,
    /// Confined source-tree identity captured during preparation.
    pub source: PathBuf,
    /// SHA-256 of the generation's exact input bytes.
    pub digest: String,
    /// Additional physical input names that retain source protection and invalidation.
    pub aliases: Vec<String>,
}

impl OpaqueAsset {
    /// Logical and physical source input names, without duplicate asset payloads.
    pub fn input_paths(&self) -> impl Iterator<Item = &String> {
        std::iter::once(&self.path).chain(&self.aliases)
    }
}

/// Fully prepared stylesheet bundle and private source inventory.
#[derive(Clone, Debug)]
pub struct Bundle {
    /// Consumed-byte witnesses and explicitly incomplete late baselines.
    pub read_evidence: ReadEvidence,
    /// Route inside the generated namespace.
    pub route: String,
    /// Normalized CSS with one final LF.
    pub css: String,
    /// Generated asset routes and digest-only source identities.
    pub assets: BTreeMap<String, OpaqueAsset>,
    /// Path-scoped class exports, supplied to the sidecar before evaluation.
    pub css_modules: BTreeMap<String, BTreeMap<String, String>>,
    /// Parsed CSS source bytes used by the graph key, keyed by logical path.
    pub inputs: BTreeMap<String, Vec<u8>>,
    /// Importing stylesheet for each protected source and asset.
    pub imported_by: BTreeMap<String, String>,
    /// Logical aliases whose real source is repository-owned, rather than an installation.
    pub repository_aliases: BTreeSet<String>,
    /// Digests of plugin-reported dependencies, without retained file bytes.
    pub dependency_digests: BTreeMap<String, String>,
    /// Plugin provenance for protected inputs.
    pub plugin_inputs: BTreeMap<String, PluginInput>,
    /// Directory watches, including empty matching sets.
    pub directories: Vec<DirectoryDependency>,
}

/// Sidecar processing result. Dependency scanning belongs to its adapter.
#[derive(Clone, Debug)]
pub struct ProcessedCss {
    /// Read versions kept separately from watch reports and scan digests.
    pub read_evidence: ReadEvidence,
    /// Reporter provenance for each protected file or alias.
    pub plugin_inputs: BTreeMap<String, PluginInput>,
    /// Validated directory watch recipes.
    pub directories: Vec<DirectoryDependency>,
    /// Transformed CSS.
    pub text: String,
    /// Validated dependency digests for graph keys and privacy.
    pub inputs: BTreeMap<String, String>,
}

/// Consumer PostCSS seam; HTML-only catalogues use the identity implementation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CssProcessorMock))]
pub trait CssProcessor: Send + Sync {
    /// Process after import pruning and before CSS Modules scoping.
    fn process(
        &self,
        path: &str,
        source: &str,
        excluded: &BTreeSet<String>,
    ) -> Result<ProcessedCss>;
}

/// No consumer plugins configured.
pub struct IdentityProcessor;

impl CssProcessor for IdentityProcessor {
    fn process(
        &self,
        _path: &str,
        source: &str,
        _excluded: &BTreeSet<String>,
    ) -> Result<ProcessedCss> {
        Ok(ProcessedCss {
            read_evidence: ReadEvidence::default(),
            text: source.into(),
            inputs: BTreeMap::new(),
            plugin_inputs: BTreeMap::new(),
            directories: Vec::new(),
        })
    }
}

/// Object-safe stylesheet orchestration boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StylesheetBundlerMock))]
pub trait StylesheetBundler: Send + Sync {
    /// Read, transform, scope, and bundle one root without file writes.
    fn bundle(&self, root: &StylesheetRoot) -> Result<Bundle>;
}
