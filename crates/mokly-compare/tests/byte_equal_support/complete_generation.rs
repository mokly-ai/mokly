//! Transparent test wrapper declines only equal-document optimization evidence.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::asset_delivery::AssetRead;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::comparison_input::RetainedComparisonInput;
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, DocumentProof, ProofMode};
use mokly_graph::comparison_stream::ComparisonConsumer;
use mokly_graph::error::Result;
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::{
    ComparisonCapture, ComparisonDocument, DocumentPlan, RenderGeneration, RenderSummary,
    TemporaryDocument,
};
use mokly_graph::workers::{ComparisonTask, ComparisonWorker};
use mokly_model::data::Props;
use mokly_model::usage::CatalogueUsage;

/// The base form declines optimization; an optional head edit supplies metadata-only cases.
pub struct CompleteGeneration(pub Arc<dyn RenderGeneration>, pub Option<fn(&mut Artifact)>);

impl CompleteGeneration {
    fn annotate(&self, artifact: Arc<Artifact>) -> Arc<Artifact> {
        match self.1 {
            None => artifact,
            Some(edit) => {
                let mut artifact = (*artifact).clone();
                edit(&mut artifact);
                Arc::new(artifact)
            }
        }
    }
}

impl GeneratedResources for CompleteGeneration {
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        self.0.resource(route)
    }
    fn open_asset(&self, route: &str) -> Result<Option<Box<dyn AssetRead>>> {
        self.0.open_asset(route)
    }
    fn contains_resource(&self, route: &str) -> Result<bool> {
        self.0.contains_resource(route)
    }
    fn is_document(&self, route: &str) -> bool {
        self.0.is_document(route)
    }
}

impl RenderGeneration for CompleteGeneration {
    fn check_cancelled(&self) -> Result<()> {
        self.0.check_cancelled()
    }
    fn comparison_capture(&self) -> Option<ComparisonCapture> {
        self.1
            .is_none()
            .then(|| self.0.comparison_capture())
            .flatten()
    }
    fn generation_key(&self) -> &str {
        self.0.generation_key()
    }
    fn plans(&self) -> &BTreeMap<String, DocumentPlan> {
        self.0.plans()
    }
    fn catalogue(&self) -> &PreparedCatalogue {
        self.0.catalogue()
    }
    fn render(&self, route: &str) -> Result<Arc<Artifact>> {
        Ok(self.annotate(self.0.render(route)?))
    }
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        Ok(self.annotate(self.0.comparison_document(route)?))
    }
    fn retained_comparison_input(&self, route: &str) -> Option<RetainedComparisonInput> {
        self.1
            .is_none()
            .then(|| self.0.retained_comparison_input(route))
            .flatten()
    }
    fn comparison_identity(
        &self,
        read: ComparisonRead,
        route: &str,
        mode: ProofMode,
    ) -> Option<ContentIdentity> {
        self.1
            .is_none()
            .then(|| self.0.comparison_identity(read, route, mode))
            .flatten()
    }
    fn comparison_document_proof(&self, route: &str) -> Option<DocumentProof> {
        self.1
            .is_none()
            .then(|| self.0.comparison_document_proof(route))
            .flatten()
    }
    fn comparison_usage(&self, route: &str) -> Result<Option<CatalogueUsage>> {
        if self.1.is_some() {
            return Ok(self
                .comparison_document(route)?
                .document
                .as_ref()
                .map(|document| document.usage.clone()));
        }
        self.0.comparison_usage(route)
    }
    fn comparison_parallelism(&self) -> usize {
        self.0.comparison_parallelism()
    }
    fn schedule_comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.0.schedule_comparison_tasks(count, task);
    }
    fn schedule_comparison_stream(
        &self,
        task: &dyn ComparisonTask,
        consumer: &mut dyn ComparisonConsumer,
    ) {
        self.0.schedule_comparison_stream(task, consumer);
    }
    fn schedule_comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        self.0.schedule_comparison(routes, worker)
    }
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>> {
        self.0.resource_bytes(route)
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        self.0.resource_digest(route)
    }
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument> {
        self.0.render_props(route, props)
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        self.0.closure(route)
    }
    fn render_all(&self) -> Result<RenderSummary> {
        self.0.render_all()
    }
    fn collect_comparison(&self, collector: &mut dyn ComparisonCollector) -> Result<RenderSummary> {
        self.0.collect_comparison(collector)
    }
    fn resource_routes(&self) -> Vec<String> {
        self.0.resource_routes()
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        self.0.stylesheet_directories()
    }
    fn public_files(&self) -> BTreeSet<String> {
        self.0.public_files()
    }
    fn watch_files(&self) -> BTreeSet<String> {
        self.0.watch_files()
    }
    fn observe_resources(&self, observer: Weak<dyn ResourceObserver>) {
        self.0.observe_resources(observer);
    }
    fn contains_public_file(&self, path: &str) -> bool {
        self.0.contains_public_file(path)
    }
}
