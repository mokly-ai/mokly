//! Serve's background base work bundles its stylesheet roots on its own thread.

use std::sync::Arc;

use mokly_graph::background::{BackgroundRead, BackgroundWorker};
use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumer;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_stream::ComparisonConsumer;
use mokly_graph::error::Result;
use mokly_graph::workers::{
    ArtifactWorker, ComparisonTask, DocumentWorker, RenderWorkers, ValidatedView,
};

/// Every job but stylesheet bundling runs on the supplied render workers.
///
/// A base root can wait for Serve's sidecar admission while a foreground render holds a
/// lease. On the shared render pool, enough waiting roots would hold every worker that the
/// foreground render needs, so the trait default bundles the roots on the caller instead.
pub struct SerialStylesheets {
    /// The runtime's render scheduler.
    pub inner: Arc<dyn RenderWorkers>,
}

impl RenderWorkers for SerialStylesheets {
    fn capture_window(
        &self,
        limit: usize,
        task: &dyn ComparisonTask,
        consumer: &mut dyn CaptureConsumer,
    ) {
        self.inner.capture_window(limit, task, consumer);
    }
    fn capture_parallelism(&self) -> usize {
        self.inner.capture_parallelism()
    }
    fn prefetch_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.inner.prefetch_tasks(count, task);
    }
    fn background(&self, route: &str, worker: &dyn BackgroundWorker) -> Result<BackgroundRead> {
        self.inner.background(route, worker)
    }
    /// Phase A uses retained base inputs only and never calls the base sidecar.
    fn comparison_stream(&self, task: &dyn ComparisonTask, consumer: &mut dyn ComparisonConsumer) {
        self.inner.comparison_stream(task, consumer);
    }
    fn comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.inner.comparison_tasks(count, task);
    }
    fn comparison_parallelism(&self) -> usize {
        self.inner.comparison_parallelism()
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
