//! Eager graphs use the command's workers and bind existing capture workers at adoption.

use std::sync::{Arc, Mutex};

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_graph::background::{BackgroundRead, BackgroundWorker};
use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumer;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_stream::ComparisonConsumer;
use mokly_graph::error::Result;
use mokly_graph::workers::{
    ArtifactWorker, ComparisonTask, DocumentWorker, RenderWorkers, StylesheetWorker, ValidatedView,
};

/// Adoption selects existing capture capacity without starting new workers.
pub trait PendingWorkers: RenderWorkers {
    /// Bind the classification's original capture scheduler before prefetch starts.
    fn adopt(&self, workers: Arc<dyn RenderWorkers>);
}

pub(super) struct DeferredWorkers {
    pub(super) preparation: Arc<dyn RenderWorkers>,
    pub(super) capture: Mutex<Option<Arc<dyn RenderWorkers>>>,
}

impl DeferredWorkers {
    fn current(&self) -> Arc<dyn RenderWorkers> {
        self.capture
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .unwrap_or(&self.preparation)
            .clone()
    }
}

impl PendingWorkers for DeferredWorkers {
    fn adopt(&self, workers: Arc<dyn RenderWorkers>) {
        *self
            .capture
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(workers);
    }
}

impl RenderWorkers for DeferredWorkers {
    fn capture_window(
        &self,
        limit: usize,
        task: &dyn ComparisonTask,
        consumer: &mut dyn CaptureConsumer,
    ) {
        self.current().capture_window(limit, task, consumer);
    }
    fn prefetch_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.current().prefetch_tasks(count, task);
    }
    fn background(&self, route: &str, worker: &dyn BackgroundWorker) -> Result<BackgroundRead> {
        self.current().background(route, worker)
    }
    fn capture_parallelism(&self) -> usize {
        self.current().capture_parallelism()
    }
    fn comparison_tasks(&self, count: usize, task: &dyn ComparisonTask) {
        self.current().comparison_tasks(count, task);
    }
    fn comparison_stream(&self, task: &dyn ComparisonTask, consumer: &mut dyn ComparisonConsumer) {
        self.current().comparison_stream(task, consumer);
    }
    fn comparison_parallelism(&self) -> usize {
        self.current().comparison_parallelism()
    }
    fn cancelled(&self) -> bool {
        self.current().cancelled()
    }
    fn closure(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Closure> {
        self.current().closure(route, worker)
    }
    fn document(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Arc<Artifact>> {
        self.current().document(route, worker)
    }
    fn run(&self, routes: &[String], worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>> {
        self.current().run(routes, worker)
    }
    fn stylesheets(
        &self,
        roots: &[StylesheetRoot],
        worker: &dyn StylesheetWorker,
    ) -> Result<Vec<Bundle>> {
        self.preparation.stylesheets(roots, worker)
    }
}
