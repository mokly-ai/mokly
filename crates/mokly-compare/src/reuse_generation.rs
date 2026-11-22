//! A per-view generation wrapper records every comparison input read.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::comparison_input::{RetainedComparisonInput, RetainedDocumentEvidence};
use mokly_graph::comparison_proof::ComparisonRead;
use mokly_graph::error::Result;
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::{
    ComparisonCapture, DocumentPlan, RenderGeneration, RenderSummary, TemporaryDocument,
};
use mokly_model::data::Props;
use mokly_model::review_affected::ReviewSide;

use crate::reuse_reads::Recorder;

pub(crate) struct RecordingGeneration<'a> {
    pub(crate) inner: &'a dyn RenderGeneration,
    pub(crate) recorder: &'a Recorder,
    pub(crate) side: ReviewSide,
}

impl GeneratedResources for RecordingGeneration<'_> {
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        let value = self.inner.resource(route)?;
        self.recorder.record(
            self.inner,
            self.side,
            ComparisonRead::Resource,
            &format!("static/mokly-generated/{route}"),
        );
        Ok(value)
    }
    fn is_document(&self, route: &str) -> bool {
        self.inner.is_document(route)
    }
}
impl RenderGeneration for RecordingGeneration<'_> {
    fn prepare_render_reuse(&self) {
        self.inner.prepare_render_reuse();
    }

    fn retained_document_evidence(&self, route: &str) -> Option<RetainedDocumentEvidence> {
        let evidence = self.inner.retained_document_evidence(route)?;
        self.recorder
            .record(self.inner, self.side, ComparisonRead::Document, route);
        self.recorder
            .record(self.inner, self.side, ComparisonRead::Closure, route);
        Some(evidence)
    }

    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        let document = self.inner.comparison_document(route)?;
        self.recorder
            .record(self.inner, self.side, ComparisonRead::Document, route);
        Ok(document)
    }
    fn retained_comparison_input(&self, route: &str) -> Option<RetainedComparisonInput> {
        let input = self.inner.retained_comparison_input(route)?;
        if matches!(input, RetainedComparisonInput::Ready(_)) {
            self.recorder
                .record(self.inner, self.side, ComparisonRead::Document, route);
            self.recorder
                .record(self.inner, self.side, ComparisonRead::Closure, route);
        }
        Some(input)
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        let closure = self.inner.closure(route)?;
        self.recorder
            .record(self.inner, self.side, ComparisonRead::Closure, route);
        Ok(closure)
    }
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>> {
        let bytes = self.inner.resource_bytes(route)?;
        self.recorder
            .record(self.inner, self.side, ComparisonRead::Resource, route);
        Ok(bytes)
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        let digest = self.inner.resource_digest(route)?;
        self.recorder
            .record(self.inner, self.side, ComparisonRead::Resource, route);
        Ok(digest)
    }
    fn check_cancelled(&self) -> Result<()> {
        self.inner.check_cancelled()
    }
    fn comparison_capture(&self) -> Option<ComparisonCapture> {
        None
    }
    fn generation_key(&self) -> &str {
        self.inner.generation_key()
    }
    fn plans(&self) -> &BTreeMap<String, DocumentPlan> {
        self.inner.plans()
    }
    fn catalogue(&self) -> &PreparedCatalogue {
        self.inner.catalogue()
    }
    fn render(&self, route: &str) -> Result<Arc<Artifact>> {
        self.comparison_document(route)
    }
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument> {
        self.inner.render_props(route, props)
    }
    fn render_all(&self) -> Result<RenderSummary> {
        self.inner.render_all()
    }
    fn collect_comparison(&self, collector: &mut dyn ComparisonCollector) -> Result<RenderSummary> {
        self.inner.collect_comparison(collector)
    }
    fn resource_routes(&self) -> Vec<String> {
        self.inner.resource_routes()
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        self.inner.stylesheet_directories()
    }
    fn stylesheet_resolution_files(&self) -> BTreeSet<String> {
        self.inner.stylesheet_resolution_files()
    }
    fn stylesheet_resolution_roots(&self) -> BTreeMap<String, PathBuf> {
        self.inner.stylesheet_resolution_roots()
    }
    fn public_files(&self) -> BTreeSet<String> {
        self.inner.public_files()
    }
    fn watch_files(&self) -> BTreeSet<String> {
        self.inner.watch_files()
    }
    fn observe_resources(&self, observer: Weak<dyn ResourceObserver>) {
        self.inner.observe_resources(observer);
    }
    fn contains_public_file(&self, path: &str) -> bool {
        self.inner.contains_public_file(path)
    }
}
