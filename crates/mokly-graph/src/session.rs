//! On-demand document evaluation and eviction-safe resource reconstruction.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_css::types::StylesheetBundler;
use mokly_html::composition::Composer;
use mokly_model::data::Props;
use mokly_source_interface::tree::SourceTree;

use crate::cache::{Artifact, RenderCache};
use crate::closure::{Closure, Walker};
use crate::collection::ComparisonCollector;
use crate::delivery_inputs::DeliveryInputs;
use crate::error::Result;
use crate::graph::Graph;
use crate::policy::PublicPolicy;
use crate::reference_index::{MemoryReferenceIndex, ReferenceIndex};
use crate::requests::{MemoryRequests, Requests};
use crate::resource_inputs::ResourceObserver;
use crate::types::{
    ComparisonCapture, ComparisonDocument, DocumentPlan, RenderGeneration, RenderSummary,
    ResourcePlan, TemporaryDocument,
};
use crate::validation_summary::Summary;
use crate::workers::{ComparisonWorker, RenderWorkers, check_cancelled};
use crate::{styles, temporary, validation};

#[derive(Clone)]
pub(crate) struct Session {
    pub(crate) state: Arc<State>,
}

pub(crate) struct State {
    pub(crate) anchor_flights: Arc<dyn Requests>,
    pub(crate) observed: Arc<Mutex<BTreeSet<String>>>,
    pub(crate) observer: Arc<Mutex<Option<Weak<dyn ResourceObserver>>>>,
    pub(crate) directories: Vec<DirectoryDependency>,
    pub(crate) generation_key: String,
    pub(crate) public_files: Arc<Mutex<BTreeSet<String>>>,
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
}

pub(crate) struct SessionInput {
    pub(crate) directories: Vec<DirectoryDependency>,
    pub(crate) config: ResolvedConfig,
    pub(crate) catalogue: PreparedCatalogue,
    pub(crate) plans: BTreeMap<String, DocumentPlan>,
    pub(crate) resources: BTreeMap<String, ResourcePlan>,
    pub(crate) policy: Arc<dyn PublicPolicy>,
    pub(crate) generation_key: String,
    pub(crate) matchers: styles::Matchers,
}

impl Session {
    pub(crate) fn new(graph: &Graph, input: SessionInput) -> Self {
        for plan in input.plans.values() {
            graph.inputs.resources.retain(&plan.resource_key);
        }
        Self {
            state: Arc::new(State {
                anchor_flights: Arc::new(MemoryRequests::default()),
                observed: Arc::new(Mutex::new(
                    input
                        .plans
                        .values()
                        .flat_map(|plan| {
                            graph.inputs.resources.paths(&plan.resource_key).into_keys()
                        })
                        .collect(),
                )),
                observer: Arc::new(Mutex::new(None)),
                generation_key: input.generation_key,
                directories: input.directories,
                public_files: Arc::new(Mutex::new(BTreeSet::new())),
                matchers: Arc::new(input.matchers),
                reference_index: Arc::new(MemoryReferenceIndex::default()),
                inputs: graph.inputs.clone(),
                config: Arc::new(input.config),
                catalogue: Arc::new(input.catalogue),
                plans: Arc::new(input.plans),
                resources: Arc::new(input.resources),
                tree: graph.tree.clone(),
                composer: graph.composer.clone(),
                stylesheets: graph.stylesheets.clone(),
                cache: graph.cache.clone(),
                workers: graph.workers.clone(),
                policy: input.policy,
            }),
        }
    }

    pub(crate) fn preview_walker(&self) -> Walker {
        Walker {
            observer: None,
            ..self.walker()
        }
    }

    pub(crate) fn walker(&self) -> Walker {
        Walker {
            observer: Some(Arc::new(self.clone())),
            tree: self.state.tree.clone(),
            policy: self.state.policy.clone(),
            generated: Arc::new(self.clone()),
            index: self.state.reference_index.clone(),
        }
    }
}

impl RenderGeneration for Session {
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
    fn catalogue(&self) -> &PreparedCatalogue {
        &self.state.catalogue
    }
    fn comparison_parallelism(&self) -> usize {
        self.state.workers.comparison_parallelism()
    }
    fn schedule_comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        self.state.workers.comparison(routes, worker)
    }
    fn comparison_batch(&self, routes: &[String]) -> Result<Vec<ComparisonDocument>> {
        self.schedule_comparison(routes, self).into_iter().collect()
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
        summary.finish(self)
    }
    fn collect_comparison(&self, collector: &mut dyn ComparisonCollector) -> Result<RenderSummary> {
        self.collect_validated(collector)
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        &self.state.directories
    }
    fn resource_routes(&self) -> Vec<String> {
        self.state.resources.keys().cloned().collect()
    }
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument> {
        temporary::render(self, route, props)
    }
    fn public_files(&self) -> BTreeSet<String> {
        self.state
            .public_files
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
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
            .public_files
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .contains(path)
    }
}

impl Drop for State {
    fn drop(&mut self) {
        for plan in self.plans.values() {
            self.inputs.resources.release(&plan.resource_key);
        }
    }
}
