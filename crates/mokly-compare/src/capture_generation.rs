//! Replay captured views and forward scheduling through the original generation.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::asset_delivery::AssetRead;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::comparison_input::{RetainedComparisonInput, RetainedDocumentEvidence};
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, ProofMode, content_identity};
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

use crate::capture_fallback::RestoreFallback;
use crate::capture_restore::DocumentRestorer;
use crate::capture_styles::EncodedResource;
use crate::comparison_capture::CapturedView;

pub(crate) struct CapturedGeneration {
    pub(crate) source: Arc<dyn RenderGeneration>,
    pub(crate) views: BTreeMap<String, CapturedView>,
    pub(crate) summary: RenderSummary,
    pub(crate) styles: BTreeMap<String, EncodedResource>,
    pub(crate) retained_bytes: usize,
    pub(crate) encoded_bytes: usize,
    pub(crate) restorer: Box<dyn DocumentRestorer>,
}

impl GeneratedResources for CapturedGeneration {
    fn open_asset(&self, route: &str) -> Result<Option<Box<dyn AssetRead>>> {
        self.source.open_asset(route)
    }
    fn contains_resource(&self, route: &str) -> Result<bool> {
        self.source.contains_resource(route)
    }
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        if let Some(style) = self
            .styles
            .get(route)
            .filter(|resource| resource.retains_bytes())
        {
            return Ok(style.read());
        }
        self.source.resource(route)
    }
    fn is_document(&self, route: &str) -> bool {
        self.source.is_document(route)
    }
}

impl RenderGeneration for CapturedGeneration {
    fn retained_document_evidence(&self, route: &str) -> Option<RetainedDocumentEvidence> {
        if !self.restorer.proves_restore() {
            return None;
        }
        let view = self.views.get(route)?;
        Some(RetainedDocumentEvidence {
            identity: view.identity,
            closure: view.closure.clone(),
        })
    }

    fn comparison_identity(
        &self,
        read: ComparisonRead,
        route: &str,
        mode: ProofMode,
    ) -> Option<ContentIdentity> {
        if matches!(read, ComparisonRead::Document | ComparisonRead::Closure)
            && self.views.contains_key(route)
            && !self.restorer.proves_restore()
        {
            return None;
        }
        if read == ComparisonRead::Resource
            && let Some(style) = route
                .strip_prefix("static/mokly-generated/")
                .and_then(|route| self.styles.get(route))
        {
            return Some(content_identity(&serde_json::to_vec(&style.digest).ok()?));
        }
        self.source.comparison_identity(read, route, mode)
    }
    fn comparison_usage(&self, route: &str) -> Result<Option<CatalogueUsage>> {
        if let Some(view) = self.views.get(route) {
            return Ok(view.document.usage().cloned());
        }
        self.source.comparison_usage(route)
    }
    fn comparison_parallelism(&self) -> usize {
        self.source.comparison_parallelism()
    }
    fn schedule_comparison_stream(
        &self,
        task: &dyn ComparisonTask,
        consumer: &mut dyn ComparisonConsumer,
    ) {
        self.source.schedule_comparison_stream(task, consumer);
    }
    fn schedule_comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.source.schedule_comparison_tasks(count, task);
    }
    fn schedule_comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        self.source.schedule_comparison(routes, worker)
    }
    fn retained_comparison_input(&self, route: &str) -> Option<RetainedComparisonInput> {
        let view = self.views.get(route)?;
        Some(match self.restorer.restore(&view.document) {
            Ok(artifact) => RetainedComparisonInput::Ready(ComparisonDocument {
                artifact: Arc::new(artifact),
                closure: view.closure.clone(),
            }),
            Err(error) => RetainedComparisonInput::Deferred(Box::new(RestoreFallback {
                source: self.source.clone(),
                captured: view.closure.clone(),
                error,
            })),
        })
    }
    fn check_cancelled(&self) -> Result<()> {
        self.source.check_cancelled()
    }

    fn comparison_capture(&self) -> Option<ComparisonCapture> {
        Some(ComparisonCapture {
            source: self.source.clone(),
            views: self.views.len(),
            retained_bytes: self.retained_bytes,
            encoded_bytes: self.encoded_bytes,
        })
    }

    fn generation_key(&self) -> &str {
        self.source.generation_key()
    }
    fn plans(&self) -> &BTreeMap<String, DocumentPlan> {
        self.source.plans()
    }
    fn catalogue(&self) -> &PreparedCatalogue {
        self.source.catalogue()
    }
    fn render(&self, route: &str) -> Result<Arc<Artifact>> {
        self.comparison_document(route)
    }
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        if let Some(view) = self.views.get(route) {
            match self.restorer.restore(&view.document) {
                Ok(artifact) => return Ok(Arc::new(artifact)),
                Err(_) => {
                    tracing::error!("comparison capture document restore failed; reading source")
                }
            }
        }
        self.source.comparison_document(route)
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        if let Some(view) = self.views.get(route) {
            return Ok(view.closure.clone());
        }
        self.source.closure(route)
    }
    /// Replays every captured view, checking cancellation before each one, also on
    /// cache hits, so a cancelled generation stops with its own cancellation error.
    fn collect_comparison(&self, collector: &mut dyn ComparisonCollector) -> Result<RenderSummary> {
        let summary = self.summary.clone();
        collector.summary(&summary);
        for route in self.source.plans().keys() {
            let input = self.comparison_input(route)?;
            self.check_cancelled()?;
            collector.collect(route, input)?;
        }
        Ok(summary)
    }
    fn render_all(&self) -> Result<RenderSummary> {
        Ok(self.summary.clone())
    }
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument> {
        self.source.render_props(route, props)
    }
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>> {
        if let Some(style) = route
            .strip_prefix("static/mokly-generated/")
            .and_then(|route| self.styles.get(route))
            .filter(|resource| resource.retains_bytes())
        {
            return Ok(style.read());
        }
        self.source.resource_bytes(route)
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        if let Some(style) = route
            .strip_prefix("static/mokly-generated/")
            .and_then(|route| self.styles.get(route))
        {
            return Ok(style.digest.clone());
        }
        self.source.resource_digest(route)
    }
    fn resource_routes(&self) -> Vec<String> {
        self.source.resource_routes()
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        self.source.stylesheet_directories()
    }
    fn stylesheet_resolution_files(&self) -> BTreeSet<String> {
        self.source.stylesheet_resolution_files()
    }
    fn public_files(&self) -> BTreeSet<String> {
        self.source.public_files()
    }
    fn watch_files(&self) -> BTreeSet<String> {
        self.source.watch_files()
    }
    fn observe_resources(&self, observer: Weak<dyn ResourceObserver>) {
        self.source.observe_resources(observer);
    }
    fn contains_public_file(&self, path: &str) -> bool {
        self.source.contains_public_file(path)
    }
}
