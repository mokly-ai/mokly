//! A classification checks cancellation and records only its own base read failures.

use std::collections::{BTreeMap, BTreeSet};
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::asset_delivery::AssetRead;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::comparison_input::{RetainedComparisonInput, RetainedDocumentEvidence};
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, ProofMode};
use mokly_graph::comparison_stream::ComparisonConsumer;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::{
    ComparisonCapture, ComparisonDocument, DocumentPlan, RenderGeneration, RenderSummary,
    TemporaryDocument,
};
use mokly_graph::workers::{ComparisonTask, ComparisonWorker};
use mokly_model::data::Props;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_model::usage::CatalogueUsage;

use crate::base_retention::BaseReuse;

pub(crate) struct BaseReader {
    state: Arc<ReadState>,
}

struct ReadState {
    reuse: BaseReuse,
    failed: AtomicBool,
}

impl BaseReader {
    pub(crate) fn new(reuse: BaseReuse) -> Self {
        Self {
            state: Arc::new(ReadState {
                reuse,
                failed: AtomicBool::new(false),
            }),
        }
    }

    pub(crate) fn failed(&self) -> bool {
        self.state.failed.load(Ordering::Acquire)
    }
}

impl ReadState {
    fn check_cancelled(&self) -> Result<()> {
        if self.reuse.cancellation.cancelled() {
            return Err(GraphError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Cancelled,
                    message: "comparison cancelled".into(),
                },
            });
        }
        self.reuse.base.generation.check_cancelled()
    }

    fn record<T>(&self, result: Result<T>) -> Result<T> {
        if result.is_err()
            && !self.reuse.cancellation.cancelled()
            && !self.failed.swap(true, Ordering::AcqRel)
        {
            self.reuse.releaser.release(&self.reuse.base);
        }
        result
    }

    fn read<T>(&self, call: impl FnOnce(&dyn RenderGeneration) -> Result<T>) -> Result<T> {
        self.check_cancelled()?;
        self.record(call(self.reuse.base.generation.as_ref()))
    }
}

struct ReaderAsset {
    inner: Box<dyn AssetRead>,
    state: Arc<ReadState>,
}

impl AssetRead for ReaderAsset {
    fn length(&self) -> u64 {
        self.inner.length()
    }
    fn copy_to(&mut self, output: &mut dyn Write) -> Result<()> {
        self.state.check_cancelled()?;
        self.state.record(self.inner.copy_to(output))
    }
}

impl GeneratedResources for BaseReader {
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        self.state.read(|base| base.resource(route))
    }
    fn open_asset(&self, route: &str) -> Result<Option<Box<dyn AssetRead>>> {
        Ok(self
            .state
            .read(|base| base.open_asset(route))?
            .map(|inner| -> Box<dyn AssetRead> {
                Box::new(ReaderAsset {
                    inner,
                    state: self.state.clone(),
                })
            }))
    }
    fn contains_resource(&self, route: &str) -> Result<bool> {
        self.state.read(|base| base.contains_resource(route))
    }
    fn is_document(&self, route: &str) -> bool {
        self.state.reuse.base.generation.is_document(route)
    }
}

impl RenderGeneration for BaseReader {
    fn retained_document_evidence(&self, route: &str) -> Option<RetainedDocumentEvidence> {
        self.state.check_cancelled().ok()?;
        self.state
            .reuse
            .base
            .generation
            .retained_document_evidence(route)
    }

    fn comparison_identity(
        &self,
        read: ComparisonRead,
        route: &str,
        mode: ProofMode,
    ) -> Option<ContentIdentity> {
        if mode != ProofMode::Retained || self.failed() {
            return None;
        }
        self.state.check_cancelled().ok()?;
        let identity = self.state.reuse.base.generation.comparison_identity(
            read,
            route,
            ProofMode::Retained,
        )?;
        self.state.check_cancelled().ok()?;
        (!self.failed()).then_some(identity)
    }
    fn check_cancelled(&self) -> Result<()> {
        self.state.check_cancelled()
    }
    fn comparison_capture(&self) -> Option<ComparisonCapture> {
        None
    }
    fn generation_key(&self) -> &str {
        self.state.reuse.base.generation.generation_key()
    }
    fn plans(&self) -> &BTreeMap<String, DocumentPlan> {
        self.state.reuse.base.generation.plans()
    }
    fn catalogue(&self) -> &PreparedCatalogue {
        self.state.reuse.base.generation.catalogue()
    }
    fn render(&self, route: &str) -> Result<Arc<Artifact>> {
        self.state.read(|base| base.render(route))
    }
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        self.state.read(|base| base.comparison_document(route))
    }
    fn comparison_usage(&self, route: &str) -> Result<Option<CatalogueUsage>> {
        self.state.check_cancelled()?;
        if let Ok(Some(usage)) = self.state.reuse.base.generation.comparison_usage(route) {
            return Ok(Some(usage));
        }
        Ok(self
            .comparison_document(route)?
            .document
            .as_ref()
            .map(|document| document.usage.clone()))
    }
    fn retained_comparison_input(&self, route: &str) -> Option<RetainedComparisonInput> {
        self.state.check_cancelled().ok()?;
        match self
            .state
            .reuse
            .base
            .generation
            .retained_comparison_input(route)?
        {
            RetainedComparisonInput::Ready(input) => Some(RetainedComparisonInput::Ready(input)),
            RetainedComparisonInput::Deferred(_) => None,
        }
    }
    fn comparison_parallelism(&self) -> usize {
        self.state.reuse.base.generation.comparison_parallelism()
    }
    fn schedule_comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.state
            .reuse
            .base
            .generation
            .schedule_comparison_tasks(count, task);
    }
    fn schedule_comparison_stream(
        &self,
        task: &dyn ComparisonTask,
        consumer: &mut dyn ComparisonConsumer,
    ) {
        self.state
            .reuse
            .base
            .generation
            .schedule_comparison_stream(task, consumer);
    }
    fn schedule_comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        self.state
            .reuse
            .base
            .generation
            .schedule_comparison(routes, worker)
    }
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>> {
        self.state.read(|base| base.resource_bytes(route))
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        self.state.read(|base| base.resource_digest(route))
    }
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument> {
        self.state.read(|base| base.render_props(route, props))
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        self.state.read(|base| base.closure(route))
    }
    fn render_all(&self) -> Result<RenderSummary> {
        self.state.read(|base| base.render_all())
    }
    fn collect_comparison(&self, collector: &mut dyn ComparisonCollector) -> Result<RenderSummary> {
        let summary = self.render_all()?;
        collector.summary(&summary);
        for route in self.plans().keys() {
            let input = self.comparison_input(route)?;
            self.check_cancelled()?;
            collector.collect(route, input)?;
        }
        Ok(summary)
    }
    fn resource_routes(&self) -> Vec<String> {
        self.state.reuse.base.generation.resource_routes()
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        self.state.reuse.base.generation.stylesheet_directories()
    }
    fn public_files(&self) -> BTreeSet<String> {
        self.state.reuse.base.generation.public_files()
    }
    fn watch_files(&self) -> BTreeSet<String> {
        self.state.reuse.base.generation.watch_files()
    }
    fn observe_resources(&self, observer: Weak<dyn ResourceObserver>) {
        self.state.reuse.base.generation.observe_resources(observer);
    }
    fn contains_public_file(&self, path: &str) -> bool {
        self.state.reuse.base.generation.contains_public_file(path)
    }
}
