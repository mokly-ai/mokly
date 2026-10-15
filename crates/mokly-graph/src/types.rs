//! Render generation plans are metadata; rendered documents stay in the cache.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::types::StylesheetRoot;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::data::Props;

use crate::cache::Artifact;
use crate::closure::{Closure, GeneratedResources};
use crate::error::Result;
use crate::key::NodeKey;

/// A document's input key and render recipe, available before rendering.
#[derive(Clone, Debug)]
pub struct DocumentPlan {
    /// Route inside the generated namespace.
    pub route: String,
    /// Document node input hash, exposed as documentKey in the index.
    pub key: NodeKey,
    /// Index in the prepared catalogue's entry list.
    pub entry: usize,
    /// Absent for pages and documents.
    pub viewport: Option<Viewport>,
    /// Effective scheme, light for an authored page.
    pub color_scheme: ColorScheme,
    /// Ordered portable stylesheet hrefs.
    pub stylesheets: Vec<String>,
}

#[derive(Clone, Debug)]
pub(crate) struct ResourcePlan {
    pub(crate) key: NodeKey,
    pub(crate) content_type: String,
    pub(crate) root: StylesheetRoot,
    pub(crate) asset: Option<String>,
}

/// Build's retained evidence contains no catalogue-wide parsed tree set.
#[derive(Clone, Debug, Default)]
pub struct RenderSummary {
    /// Rendered documents, excluding use cases.
    pub documents: usize,
    /// Sorted unique diagnostics from preparation and composition.
    pub warnings: Vec<Warning>,
    /// Complete authored resource closure for the generation.
    pub closure: BTreeSet<String>,
}

/// Shared generation interface for Serve, comparison, and static output.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenderGenerationMock))]
pub trait RenderGeneration: GeneratedResources {
    /// Hash of every config, source, stylesheet, and bundle render input.
    fn generation_key(&self) -> &str;
    /// All document keys, available without any document render.
    fn plans(&self) -> &BTreeMap<String, DocumentPlan>;
    /// Validated private catalogue, including its complete source inventory.
    fn catalogue(&self) -> &PreparedCatalogue;
    /// Obtain one document, using the cache or rendering an evicted node again.
    fn render(&self, route: &str) -> Result<Arc<Artifact>>;
    /// Obtain the referenced authored files and evidence of one document.
    fn closure(&self, route: &str) -> Result<Closure>;
    /// Render and validate every view across the worker pool.
    fn render_all(&self) -> Result<RenderSummary>;
    /// All generated stylesheet and asset routes of this generation.
    fn resource_routes(&self) -> Vec<String>;
    /// Render edited props through the same graph without retaining transient bytes.
    fn render_props(&self, route: &str, props: &Props) -> Result<TransientDocument>;
    /// All authored files reached by completed documents of this generation.
    fn public_files(&self) -> BTreeSet<String>;
    /// Check reached membership without copying the generation's complete set.
    fn contains_public_file(&self, path: &str) -> bool;
}

/// A complete isolated preview with its validated public closure.
pub struct TransientDocument {
    /// Rendered document and usage.
    pub artifact: Arc<Artifact>,
    /// Referenced authored files to copy into the bounded preview store.
    pub closure: Closure,
}

/// Prepare graph nodes against one source-tree generation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenderGraphMock))]
pub trait RenderGraph: Send + Sync {
    /// Resolve stylesheet nodes and document input keys without rendering documents.
    fn prepare(
        &self,
        config: ResolvedConfig,
        catalogue: PreparedCatalogue,
        output: Option<&Path>,
    ) -> Result<Arc<dyn RenderGeneration>>;
}

/// Composition-root factory for graph dependencies that need resolved configuration.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = GraphFactoryMock))]
pub trait GraphFactory: Send + Sync {
    /// Construct a graph over the current source tree and injected services.
    fn create(&self, config: &ResolvedConfig) -> Result<Arc<dyn RenderGraph>>;
}
