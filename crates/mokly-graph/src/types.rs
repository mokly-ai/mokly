//! Render generation plans are metadata; rendered documents stay in the cache.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::{Arc, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_css::types::{OpaqueAsset, StylesheetRoot};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::data::Props;

use crate::cache::Artifact;
use crate::closure::{Closure, GeneratedResources};
use crate::error::Result;
use crate::key::NodeKey;
use crate::resource_inputs::ResourceObserver;
use crate::workers::ComparisonWorker;

/// A document's input key and render recipe, available before rendering.
#[derive(Clone, Debug)]
pub struct DocumentPlan {
    /// Source recipe before discovered resource bytes enter the document key.
    pub resource_key: String,
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
    pub(crate) document_key: NodeKey,
    pub(crate) content_type: String,
    pub(crate) root: StylesheetRoot,
    pub(crate) asset: Option<OpaqueAsset>,
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

/// Private comparison inputs retained over one original generation.
#[derive(Clone)]
pub struct ComparisonCapture {
    /// Uncaptured recipes and source leases, used when a smaller budget is requested.
    pub source: Arc<dyn RenderGeneration>,
    /// Number of documents retained in the capture.
    pub views: usize,
    /// Charged payload and Rust metadata bytes.
    pub retained_bytes: usize,
    /// Compressed document and stylesheet payload bytes.
    pub encoded_bytes: usize,
}

/// One transient comparison input, released after the caller encodes its batch.
#[derive(Debug)]
pub struct ComparisonDocument {
    /// Exact document bytes and composed tree.
    pub artifact: Arc<Artifact>,
    /// Validated authored resources and comparison evidence.
    pub closure: Closure,
}

/// Shared generation interface for Serve, comparison, and static output.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenderGenerationMock))]
pub trait RenderGeneration: GeneratedResources {
    /// Return the generation's cancellation error before more view work starts.
    fn check_cancelled(&self) -> Result<()>;

    /// Reuse an existing comparison capture without stacking retained copies.
    /// Ordinary source generations return None.
    /// Wrappers that add checks must return None, not delegate: rebuilding with
    /// a smaller bound reads the capture's source and would bypass those checks.
    fn comparison_capture(&self) -> Option<ComparisonCapture>;

    /// Hash of every config, source, stylesheet, and bundle render input.
    fn generation_key(&self) -> &str;
    /// All document keys, available without any document render.
    fn plans(&self) -> &BTreeMap<String, DocumentPlan>;
    /// Validated private catalogue, including its complete source inventory.
    fn catalogue(&self) -> &PreparedCatalogue;
    /// Obtain one document, using the cache or rendering an evicted node again.
    fn render(&self, route: &str) -> Result<Arc<Artifact>>;
    /// Compose comparison material before closure checks, without changing document bytes.
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>>;
    /// Maximum number of transient comparison inputs in one scheduled batch.
    fn comparison_parallelism(&self) -> usize {
        1
    }
    /// Schedule a wrapper's own input checks on this generation's workers.
    fn schedule_comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        routes.iter().map(|route| worker.input(route)).collect()
    }
    /// Compose and validate one input after checking command cancellation.
    fn comparison_input(&self, route: &str) -> Result<ComparisonDocument> {
        self.check_cancelled()?;
        let artifact = {
            let span = tracing::info_span!("review.capture-document", status = "error");
            let _entered = span.enter();
            let artifact = self.comparison_document(route)?;
            span.record("status", "ok");
            artifact
        };
        let closure = {
            let span = tracing::info_span!("review.capture-closure", status = "error");
            let _entered = span.enter();
            let closure = self.closure(route)?;
            span.record("status", "ok");
            closure
        };
        Ok(ComparisonDocument { artifact, closure })
    }
    /// Return one input per route in request order, or the first route's failure.
    /// Callers limit each batch to comparison_parallelism; wrappers default to serial work.
    fn comparison_batch(&self, routes: &[String]) -> Result<Vec<ComparisonDocument>> {
        routes
            .iter()
            .map(|route| self.comparison_input(route))
            .collect()
    }
    /// Read a confined resource by its public route. Missing regular targets return None.
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>>;
    /// Hash a resource with bounded memory; absent resources return None.
    fn resource_digest(&self, route: &str) -> Result<Option<String>>;
    /// Render complete validated transient props through the same document pipeline.
    /// The caller applies control overrides. The result never changes catalogue state.
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument>;
    /// Obtain the referenced authored files and evidence of one document.
    fn closure(&self, route: &str) -> Result<Closure>;
    /// Render and validate every view across the worker pool.
    fn render_all(&self) -> Result<RenderSummary>;
    /// All generated stylesheet and asset routes of this generation.
    fn resource_routes(&self) -> Vec<String>;
    /// Consumer PostCSS directory watches, including empty matching sets.
    fn stylesheet_directories(&self) -> &[DirectoryDependency];
    /// All authored files reached by completed documents of this generation.
    fn public_files(&self) -> BTreeSet<String>;
    /// Lexical resource inputs, including targets that need repair.
    fn watch_files(&self) -> BTreeSet<String>;
    /// Register a weak resource subscriber without extending the watcher's lifetime.
    fn observe_resources(&self, observer: Weak<dyn ResourceObserver>);
    /// Check reached membership without copying the generation's complete set.
    fn contains_public_file(&self, path: &str) -> bool;
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

/// A transient preview and its checked closure, never inserted as a saved document.
#[derive(Clone, Debug)]
pub struct TemporaryDocument {
    /// Serialized bytes and usage from the normal composition pipeline.
    pub artifact: Arc<Artifact>,
    /// Resources checked through the generation's public-file policy.
    pub closure: Closure,
}
