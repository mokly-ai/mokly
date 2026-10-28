//! Serve's background base work bundles its stylesheet roots on its own thread.

use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::error::Result;
use mokly_graph::types::ComparisonDocument;
use mokly_graph::workers::{
    ArtifactWorker, ComparisonWorker, DocumentWorker, RenderWorkers, ValidatedView,
};

/// Every job but stylesheet bundling runs on the shared render workers.
///
/// A base root can wait for Serve's sidecar admission while a foreground render holds a
/// lease. On the shared render pool, enough waiting roots would hold every worker that the
/// foreground render needs, so the trait default bundles the roots on the caller instead.
pub struct SerialStylesheets {
    /// The shared render workers.
    pub inner: Arc<dyn RenderWorkers>,
}

impl RenderWorkers for SerialStylesheets {
    fn comparison_parallelism(&self) -> usize {
        self.inner.comparison_parallelism()
    }
    fn comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        self.inner.comparison(routes, worker)
    }
    fn cancelled(&self) -> bool {
        self.inner.cancelled()
    }
    fn closure(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Closure> {
        self.inner.closure(route, worker)
    }
    fn document(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Arc<Artifact>> {
        self.inner.document(route, worker)
    }
    fn run(&self, routes: &[String], worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>> {
        self.inner.run(routes, worker)
    }
}

#[cfg(test)]
#[path = "_tests_/serial_stylesheets_tests.rs"]
mod serial_stylesheets_tests;
