//! On-demand document evaluation and eviction-safe resource reconstruction.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_css::types::StylesheetBundler;
use mokly_html::composition::Composer;
use mokly_model::data::Props;
use mokly_source_interface::tree::SourceTree;

use crate::background::BackgroundRead;
use crate::cache::{Artifact, RenderCache};
use crate::capture_window::CaptureConsumer;
use crate::closure::Closure;
use crate::collection::ComparisonCollector;
use crate::comparison_proof::{ComparisonRead, ContentIdentity, ProofMode};
use crate::comparison_stream::ComparisonConsumer;
use crate::delivery_inputs::DeliveryInputs;
use crate::document_store::StoreKey;
use crate::error::Result;
use crate::link_index::LinkIndex;
use crate::link_results::LinkResults;
use crate::policy::PublicPolicy;
use crate::prefetch::PrefetchGuard;
use crate::prefetch_state::Flights;
use crate::reference_index::ReferenceIndex;
use crate::requests::Requests;
use crate::resource_inputs::ResourceObserver;
use crate::types::{
    ComparisonCapture, DocumentPlan, RenderGeneration, RenderSummary, ResourcePlan,
    TemporaryDocument,
};
use crate::validation_summary::Summary;
use crate::workers::{ComparisonTask, RenderWorkers, check_cancelled};
use crate::{session_prefetch, styles, temporary, validation};

#[derive(Clone)]
pub(crate) struct Session {
    pub(crate) state: Arc<State>,
}

pub(crate) struct State {
    pub(crate) prefetch: Mutex<Option<Arc<Flights>>>,
    pub(crate) fresh: Mutex<BTreeMap<String, StoreKey>>,
    pub(crate) anchor_flights: Arc<dyn Requests>,
    pub(crate) link_results: Arc<dyn LinkResults>,
    pub(crate) link_index: LinkIndex,
    pub(crate) observed: Arc<Mutex<BTreeSet<String>>>,
    pub(crate) observer: Arc<Mutex<Option<Weak<dyn ResourceObserver>>>>,
    pub(crate) directories: Vec<DirectoryDependency>,
    pub(crate) stylesheet_resolution_files: BTreeSet<String>,
    pub(crate) stylesheet_resolution_roots: BTreeMap<String, PathBuf>,
    pub(crate) generation_key: String,
    pub(crate) document_keys: BTreeSet<String>,
    pub(crate) matchers: Arc<styles::Matchers>,
    pub(crate) reference_index: Arc<dyn ReferenceIndex>,
    pub(crate) inputs: DeliveryInputs,
    pub(crate) config: Arc<ResolvedConfig>,
    pub(crate) catalogue: Arc<PreparedCatalogue>,
    pub(crate) plans: Arc<BTreeMap<String, DocumentPlan>>,
    pub(crate) resources: Arc<BTreeMap<String, ResourcePlan>>,
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) composer: Arc<dyn Composer>,
    pub(crate) stylesheets: Arc<dyn StylesheetBundler>,
    pub(crate) cache: Arc<dyn RenderCache>,
    pub(crate) workers: Arc<dyn RenderWorkers>,
    pub(crate) policy: Arc<dyn PublicPolicy>,
    pub(crate) comparison_policy: Option<ContentIdentity>,
}

pub(crate) struct SessionInput {
    pub(crate) stylesheet_resolution_files: BTreeSet<String>,
    pub(crate) stylesheet_resolution_roots: BTreeMap<String, PathBuf>,
    pub(crate) directories: Vec<DirectoryDependency>,
    pub(crate) config: ResolvedConfig,
    pub(crate) catalogue: PreparedCatalogue,
    pub(crate) plans: BTreeMap<String, DocumentPlan>,
    pub(crate) resources: BTreeMap<String, ResourcePlan>,
    pub(crate) policy: Arc<dyn PublicPolicy>,
    pub(crate) generation_key: String,
    pub(crate) matchers: styles::Matchers,
}

impl RenderGeneration for Session {
    fn read_background(&self, route: &str) -> Result<Option<BackgroundRead>> {
        self.read_background_document(route).map(Some)
    }
    fn comparison_identity(
        &self,
        read: ComparisonRead,
        route: &str,
        mode: ProofMode,
    ) -> Option<ContentIdentity> {
        self.input_identity(read, route, mode)
    }
    fn check_cancelled(&self) -> Result<()> {
        check_cancelled(self.state.workers.as_ref())
    }

    fn comparison_capture(&self) -> Option<ComparisonCapture> {
        None
    }

    fn generation_key(&self) -> &str {
        &self.state.generation_key
    }
    fn plans(&self) -> &BTreeMap<String, DocumentPlan> {
        &self.state.plans
    }
    fn uncached_documents(&self) -> Vec<String> {
        self.state
            .plans
            .iter()
            .filter(|(route, plan)| {
                !self.state.cache.contains(&plan.key) && !self.has_stored_document(route)
            })
            .map(|(route, _)| route.clone())
            .collect()
    }
    fn prefetch_comparison(&self) -> Result<Option<PrefetchGuard>> {
        session_prefetch::start(self)
    }
    fn catalogue(&self) -> &PreparedCatalogue {
        &self.state.catalogue
    }
    fn comparison_parallelism(&self) -> usize {
        self.state.workers.comparison_parallelism()
    }
    fn capture_parallelism(&self) -> usize {
        self.state.workers.capture_parallelism()
    }
    fn schedule_capture_window(
        &self,
        task: &dyn ComparisonTask,
        consumer: &mut dyn CaptureConsumer,
    ) {
        self.state
            .workers
            .capture_window(self.capture_parallelism(), task, consumer);
    }
    fn schedule_comparison_stream(
        &self,
        task: &dyn ComparisonTask,
        consumer: &mut dyn ComparisonConsumer,
    ) {
        self.state.workers.comparison_stream(task, consumer);
    }
    fn schedule_comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.state.workers.comparison_tasks(count, task);
    }
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        let artifact = self.raw(route)?;
        if let Some(document) = &artifact.document {
            validation::links(self, &document.links)?;
        }
        self.state
            .cache
            .insert(self.state.plans[route].key.clone(), artifact.clone());
        Ok(artifact)
    }
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>> {
        self.read_resource(route)
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        self.digest_resource(route)
    }
    fn render(&self, route: &str) -> Result<Arc<Artifact>> {
        self.state.workers.document(route, self)
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        self.state.workers.closure(route, self)
    }
    fn render_all(&self) -> Result<RenderSummary> {
        let routes: Vec<_> = self.state.plans.keys().cloned().collect();
        let results = self.state.workers.run(&routes, self);
        let mut summary = Summary::new(self);
        for result in results {
            summary.record(result);
        }
        let (summary, _) = summary.finish(self)?;
        for route in &routes {
            self.offer_document(route);
        }
        Ok(summary)
    }
    fn collect_comparison(&self, collector: &mut dyn ComparisonCollector) -> Result<RenderSummary> {
        self.collect_validated(collector)
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        &self.state.directories
    }
    fn stylesheet_resolution_files(&self) -> BTreeSet<String> {
        self.state.stylesheet_resolution_files.clone()
    }
    fn stylesheet_resolution_roots(&self) -> BTreeMap<String, PathBuf> {
        self.state.stylesheet_resolution_roots.clone()
    }
    fn resource_routes(&self) -> Vec<String> {
        self.state.resources.keys().cloned().collect()
    }
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument> {
        temporary::render(self, route, props)
    }
    fn public_files(&self) -> BTreeSet<String> {
        self.state
            .document_keys
            .iter()
            .flat_map(|key| self.state.inputs.closures.paths(key))
            .filter(|path| self.state.policy.check(path).is_ok())
            .collect()
    }
    fn watch_files(&self) -> BTreeSet<String> {
        self.state
            .observed
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }
    fn observe_resources(&self, observer: Weak<dyn ResourceObserver>) {
        *self
            .state
            .observer
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = Some(observer);
    }
    fn contains_public_file(&self, path: &str) -> bool {
        self.state
            .inputs
            .closures
            .contains(path, &self.state.document_keys)
            && self.state.policy.check(path).is_ok()
    }
}

impl Drop for State {
    fn drop(&mut self) {
        for plan in self.plans.values() {
            self.inputs.resources.release(&plan.resource_key);
            self.inputs.closures.release(&plan.key.0);
        }
    }
}
