//! Comparison handles reject public bytes that changed after their accepted inputs.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::error::{GraphError, InternalError, Result};

use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::{
    ComparisonCapture, ComparisonDocument, DocumentPlan, RenderGeneration, RenderSummary,
    TemporaryDocument,
};
use mokly_graph::workers::ComparisonWorker;
use mokly_model::data::Props;
use mokly_model::material::digest;
use mokly_model::namespace::generated;

use crate::error::ServerError;

/// Retain only hashes; the render graph still owns documents, resources, and leases.
pub struct FrozenResources {
    inner: Arc<dyn RenderGeneration>,
    digests: Mutex<BTreeMap<String, Option<String>>>,
}
impl FrozenResources {
    /// Wrap one immutable graph without reading or rendering anything.
    pub fn new(inner: Arc<dyn RenderGeneration>) -> Self {
        Self {
            inner,
            digests: Mutex::new(BTreeMap::new()),
        }
    }

    fn check(&self, route: &str, observed: Option<String>) -> Result<()> {
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
}
impl GeneratedResources for FrozenResources {
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        self.inner.resource(route)
    }
    fn is_document(&self, route: &str) -> bool {
        self.inner.is_document(route)
    }
}
impl ComparisonWorker for FrozenResources {
    fn input(&self, route: &str) -> Result<ComparisonDocument> {
        self.comparison_input(route)
    }
}
impl RenderGeneration for FrozenResources {
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
    fn comparison_parallelism(&self) -> usize {
        self.inner.comparison_parallelism()
    }
    fn schedule_comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        self.inner.schedule_comparison(routes, worker)
    }
    fn comparison_batch(&self, routes: &[String]) -> Result<Vec<ComparisonDocument>> {
        self.schedule_comparison(routes, self).into_iter().collect()
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
    fn render_all(&self) -> Result<RenderSummary> {
        self.inner.render_all()
    }
    fn resource_routes(&self) -> Vec<String> {
        self.inner.resource_routes()
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        self.inner.stylesheet_directories()
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
