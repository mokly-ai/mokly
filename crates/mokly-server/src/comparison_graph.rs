//! Comparison handles reject public bytes that changed after their accepted inputs.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumer;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::comparison_proof::{
    ComparisonRead, ContentIdentity, DocumentProof, ProofMode, content_identity,
};
use mokly_graph::comparison_stream::ComparisonConsumer;
use mokly_graph::error::{GraphError, InternalError, Result};
use mokly_graph::head_validation::{HeadValidation, ValidationRead};

use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::{
    ComparisonCapture, DocumentPlan, RenderGeneration, RenderSummary, TemporaryDocument,
};
use mokly_graph::workers::ComparisonTask;
use mokly_model::data::Props;
use mokly_model::material::digest;
use mokly_model::namespace::generated;

use crate::comparison_collector::CheckedCollector;
use crate::error::ServerError;

/// Retain only hashes; the render graph still owns documents, resources, and leases.
#[derive(Clone)]
pub struct FrozenResources {
    pub(crate) inner: Arc<dyn RenderGeneration>,
    digests: Arc<Mutex<BTreeMap<String, Option<String>>>>,
}
impl FrozenResources {
    /// Wrap one immutable graph without reading or rendering anything.
    pub fn new(inner: Arc<dyn RenderGeneration>) -> Self {
        Self {
            inner,
            digests: Arc::new(Mutex::new(BTreeMap::new())),
        }
    }

    pub(crate) fn check(&self, route: &str, observed: Option<String>) -> Result<()> {
        let mut digests = self
            .digests
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(expected) = digests.get(route) {
            if expected != &observed {
                return Err(GraphError::Internal(InternalError::Provider {
                    source: Box::new(ServerError::ChangesReplaced),
                }));
            }
        } else {
            digests.insert(route.into(), observed);
        }
        Ok(())
    }
    pub(crate) fn document_identity(
        &self,
        route: &str,
        mode: ProofMode,
    ) -> Option<ContentIdentity> {
        let digest = self
            .digests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&generated(route))?
            .clone();
        let identity = self
            .inner
            .comparison_identity(ComparisonRead::Document, route, mode)?;
        Some(content_identity(
            &serde_json::to_vec(&(identity, digest)).ok()?,
        ))
    }
}
impl GeneratedResources for FrozenResources {
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        self.inner.resource(route)
    }
    fn is_document(&self, route: &str) -> bool {
        self.inner.is_document(route)
    }
}
impl RenderGeneration for FrozenResources {
    fn validate_head(&self, validation: &dyn HeadValidation) -> Result<RenderSummary> {
        self.head_summary(validation)
    }
    fn validation_document(&self, route: &str) -> Result<Arc<Artifact>> {
        self.checked_head(route)
    }
    fn validation_identity(&self, kind: ValidationRead, route: &str) -> Option<ContentIdentity> {
        self.head_input(kind, route)
    }
    fn prepare_render_reuse(&self) {
        self.inner.prepare_render_reuse();
    }

    fn comparison_document_proof(&self, route: &str) -> Option<DocumentProof> {
        let artifact = self.comparison_document(route).ok()?;
        Some(DocumentProof {
            identity: self.document_identity(route, ProofMode::Current)?,
            usage: artifact
                .document
                .as_ref()
                .map(|document| document.usage.clone()),
        })
    }
    /// Closure reuse also validates every prior edge through checked resource proofs.
    fn comparison_identity(
        &self,
        read: ComparisonRead,
        route: &str,
        mode: ProofMode,
    ) -> Option<ContentIdentity> {
        if mode == ProofMode::Retained {
            if read == ComparisonRead::Document {
                return self.document_identity(route, mode);
            }
            let digests = self
                .digests
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            return match read {
                ComparisonRead::Resource => Some(content_identity(
                    &serde_json::to_vec(digests.get(route)?).ok()?,
                )),
                ComparisonRead::Document => None,
                ComparisonRead::Closure => {
                    digests.get(&generated(route))?;
                    self.inner.comparison_identity(read, route, mode)
                }
            };
        }
        match read {
            ComparisonRead::Document => {
                self.comparison_document(route).ok()?;
                self.document_identity(route, mode)
            }
            ComparisonRead::Closure => self.inner.comparison_identity(read, route, mode),
            ComparisonRead::Resource => {
                let digest = self.inner.resource_digest(route).ok()?;
                self.check(route, digest.clone()).ok()?;
                Some(content_identity(&serde_json::to_vec(&digest).ok()?))
            }
        }
    }
    fn capture_parallelism(&self) -> usize {
        self.inner.capture_parallelism()
    }
    fn schedule_capture_window(
        &self,
        task: &dyn ComparisonTask,
        consumer: &mut dyn CaptureConsumer,
    ) {
        self.inner.schedule_capture_window(task, consumer);
    }
    fn comparison_parallelism(&self) -> usize {
        self.inner.comparison_parallelism()
    }
    fn schedule_comparison_stream(
        &self,
        task: &dyn ComparisonTask,
        consumer: &mut dyn ComparisonConsumer,
    ) {
        self.inner.schedule_comparison_stream(task, consumer);
    }
    fn schedule_comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.inner.schedule_comparison_tasks(count, task);
    }
    fn check_cancelled(&self) -> Result<()> {
        self.inner.check_cancelled()
    }

    /// Return None so the engine captures through these digest checks.
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
        let artifact = self.inner.render(route)?;
        self.check(&generated(route), Some(digest(&artifact.bytes)))?;
        Ok(artifact)
    }
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        let artifact = self.inner.comparison_document(route)?;
        self.check(&generated(route), Some(digest(&artifact.bytes)))?;
        Ok(artifact)
    }
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>> {
        let bytes = self.inner.resource_bytes(route)?;
        self.check(route, bytes.as_deref().map(digest))?;
        Ok(bytes)
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        if let Some(digest) = self
            .digests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(route)
            .cloned()
        {
            return Ok(digest);
        }
        let digest = self.inner.resource_digest(route)?;
        self.check(route, digest.clone())?;
        Ok(digest)
    }
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument> {
        self.inner.render_props(route, props)
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        let closure = self.inner.closure(route)?;
        for resource in closure.edges.keys() {
            self.resource_digest(resource)?;
        }
        Ok(closure)
    }
    fn collect_comparison(&self, collector: &mut dyn ComparisonCollector) -> Result<RenderSummary> {
        self.inner.collect_comparison(&mut CheckedCollector {
            resources: self,
            inner: collector,
        })
    }
    fn render_all(&self) -> Result<RenderSummary> {
        self.inner.render_all()
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

#[cfg(test)]
#[path = "_tests_/comparison_graph_tests.rs"]
mod comparison_graph_tests;

#[cfg(test)]
#[path = "_tests_/comparison_scheduling_tests.rs"]
mod comparison_scheduling_tests;

#[cfg(test)]
#[path = "_tests_/comparison_proof_tests.rs"]
mod comparison_proof_tests;
