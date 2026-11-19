//! Capture and early renders use bounded workers without holding foreground workers.

use std::sync::Arc;

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumer;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_stream::ComparisonConsumer;
use mokly_graph::error::Result;
use mokly_graph::workers::{
    ArtifactWorker, ComparisonTask, DocumentWorker, RenderWorkers, StylesheetWorker, ValidatedView,
};
use mokly_sidecar::pool_admission::PoolCapacity;

/// Current process capacity, including memory admission.
#[cfg_attr(test, unimock::unimock(api = CaptureCapacityMock))]
pub trait CaptureCapacity: Send + Sync {
    /// Maximum simultaneous capture or early-render inputs, at least one.
    fn capacity(&self) -> usize;
}

/// A command's process pool supplies capture capacity without changing admission.
pub struct PoolCaptureCapacity {
    /// Shared process-capacity boundary.
    pub pool: Arc<dyn PoolCapacity>,
}

impl CaptureCapacity for PoolCaptureCapacity {
    fn capacity(&self) -> usize {
        self.pool.capacity()
    }
}

/// Capture jobs can use separate workers while ordinary reads keep their own pool.
pub struct CaptureWorkers {
    /// Workers for ordinary renders, comparison, and preparation.
    pub inner: Arc<dyn RenderWorkers>,
    /// Workers reserved for capture and early renders.
    pub capture: Arc<dyn RenderWorkers>,
    /// Capacity shared with the existing process pool.
    pub capacity: Arc<dyn CaptureCapacity>,
}

impl RenderWorkers for CaptureWorkers {
    fn capture_parallelism(&self) -> usize {
        self.capture
            .comparison_parallelism()
            .min(self.capacity.capacity().max(1))
            .max(1)
    }
    fn capture_window(
        &self,
        limit: usize,
        task: &dyn ComparisonTask,
        consumer: &mut dyn CaptureConsumer,
    ) {
        self.capture
            .capture_window(limit.min(self.capture_parallelism()), task, consumer);
    }
    fn comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.inner.comparison_tasks(count, task);
    }
    fn comparison_stream(&self, task: &dyn ComparisonTask, consumer: &mut dyn ComparisonConsumer) {
        self.inner.comparison_stream(task, consumer);
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
    fn stylesheets(
        &self,
        roots: &[StylesheetRoot],
        worker: &dyn StylesheetWorker,
    ) -> Result<Vec<Bundle>> {
        self.inner.stylesheets(roots, worker)
    }
    fn run(&self, routes: &[String], worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>> {
        self.inner.run(routes, worker)
    }
}

#[cfg(test)]
#[path = "_tests_/capture_workers_tests.rs"]
mod capture_workers_tests;
