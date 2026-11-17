//! Test generations inject each IO operation through its own optional mock.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::error::Result;
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::{
    ComparisonCapture, DocumentPlan, RenderGeneration, RenderSummary, TemporaryDocument,
};
use mokly_graph::workers::ComparisonTask;
use mokly_model::data::Props;
use unimock::Unimock;

pub(super) struct Generation {
    pub(super) capacity: usize,
    pub(super) metadata: Unimock,
    pub(super) cancellation: Option<Unimock>,
    pub(super) validation: Option<Unimock>,
    pub(super) document: Option<Unimock>,
    pub(super) closure: Option<Unimock>,
    pub(super) resources: Option<Unimock>,
    pub(super) scheduling: Option<Unimock>,
}

impl GeneratedResources for Generation {
    fn resource(&self, _: &str) -> Result<Option<Vec<u8>>> {
        unreachable!()
    }
    fn is_document(&self, _: &str) -> bool {
        unreachable!()
    }
}

impl RenderGeneration for Generation {
    fn check_cancelled(&self) -> Result<()> {
        self.cancellation.as_ref().unwrap().check_cancelled()
    }
    fn catalogue(&self) -> &PreparedCatalogue {
        self.metadata.catalogue()
    }
    fn plans(&self) -> &BTreeMap<String, DocumentPlan> {
        self.metadata.plans()
    }
    fn comparison_capture(&self) -> Option<ComparisonCapture> {
        None
    }
    fn generation_key(&self) -> &str {
        unreachable!()
    }
    fn comparison_parallelism(&self) -> usize {
        self.capacity
    }
    fn schedule_comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.scheduling
            .as_ref()
            .unwrap()
            .schedule_comparison_tasks(count, task);
    }
    fn render_all(&self) -> Result<RenderSummary> {
        self.validation.as_ref().unwrap().render_all()
    }
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        assert!(
            self.document.is_some(),
            "a deferred base source document must remain unread after an earlier error"
        );
        self.document.as_ref().unwrap().comparison_document(route)
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        assert!(
            self.closure.is_some(),
            "a failed retained restore must use its captured closure, without source closure IO"
        );
        self.closure.as_ref().unwrap().closure(route)
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        self.resources.as_ref().unwrap().resource_digest(route)
    }
    fn resource_bytes(&self, _: &str) -> Result<Option<Vec<u8>>> {
        unreachable!()
    }
    fn render(&self, _: &str) -> Result<Arc<Artifact>> {
        unreachable!()
    }
    fn render_props(&self, _: &str, _: &Props) -> Result<TemporaryDocument> {
        unreachable!()
    }
    fn collect_comparison(&self, _: &mut dyn ComparisonCollector) -> Result<RenderSummary> {
        unreachable!()
    }
    fn resource_routes(&self) -> Vec<String> {
        unreachable!()
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        unreachable!()
    }
    fn public_files(&self) -> BTreeSet<String> {
        unreachable!()
    }
    fn watch_files(&self) -> BTreeSet<String> {
        unreachable!()
    }
    fn observe_resources(&self, _: Weak<dyn ResourceObserver>) {
        unreachable!()
    }
    fn contains_public_file(&self, _: &str) -> bool {
        unreachable!()
    }
}
