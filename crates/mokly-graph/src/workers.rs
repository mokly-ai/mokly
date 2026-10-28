//! Parallel document validation and stylesheet bundling with deterministic result order.

use std::collections::BTreeSet;
use std::fmt;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::diagnostic::Warning;
use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_html::links::Reference;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use rayon::prelude::*;

use crate::cache::Artifact;
use crate::closure::Closure;
use crate::error::{GraphError, InternalError, Result};
use crate::types::ComparisonDocument;

/// A transient comparison input collected on an existing render worker.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ComparisonWorkerMock))]
pub trait ComparisonWorker: Send + Sync {
    /// Compose and validate a document and its closure.
    fn input(&self, route: &str) -> Result<ComparisonDocument>;
}

impl fmt::Debug for dyn ComparisonWorker + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ComparisonWorker")
    }
}

/// A document action scheduled on a standard worker thread.
pub trait ArtifactWorker: Send + Sync {
    /// Compose and validate one document without scheduling another worker.
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>>;
    /// Collect a closure on the worker without scheduling a second worker.
    fn closure_job(&self, route: &str) -> Result<Closure>;
}

impl fmt::Debug for dyn ArtifactWorker + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ArtifactWorker")
    }
}

/// Retained per-view evidence after the worker releases its document tree.
#[derive(Clone, Debug)]
pub struct ValidatedView {
    /// Document route.
    pub route: String,
    /// Decoded anchor ids.
    pub anchors: BTreeSet<String>,
    /// Logical cross-view fragment references.
    pub links: Vec<Reference>,
    /// Authored closure files.
    pub closure: BTreeSet<String>,
    /// Render diagnostics.
    pub warnings: Vec<Warning>,
}

/// One worker action over one document recipe.
pub trait DocumentWorker: Send + Sync {
    /// Render and validate, then release the parsed tree.
    fn validate(&self, route: &str) -> Result<ValidatedView>;
}

impl fmt::Debug for dyn DocumentWorker + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("DocumentWorker")
    }
}

/// One stylesheet root bundled on a render worker.
pub trait StylesheetWorker: Send + Sync {
    /// Bundle one root without scheduling another worker.
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle>;
}

impl fmt::Debug for dyn StylesheetWorker + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("StylesheetWorker")
    }
}

/// Worker scheduling is an injectable runtime boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenderWorkersMock))]
pub trait RenderWorkers: Send + Sync {
    /// Existing capacity for bounded comparison batches.
    fn comparison_parallelism(&self) -> usize {
        1
    }
    /// Retain input order and failures while collecting a bounded caller-owned batch.
    fn comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        routes.iter().map(|route| worker.input(route)).collect()
    }
    /// Whether the command has cancelled preparation and queued document work.
    fn cancelled(&self) -> bool {
        false
    }
    /// Collect an on-demand closure on a render worker.
    fn closure(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Closure> {
        worker.closure_job(route)
    }
    /// Render an on-demand document on the same stack as complete builds.
    fn document(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Arc<Artifact>> {
        worker.artifact(route)
    }
    /// Bundle every root in root order, or return the first failure in root order.
    /// No root starts after an earlier root failed.
    fn stylesheets(
        &self,
        roots: &[StylesheetRoot],
        worker: &dyn StylesheetWorker,
    ) -> Result<Vec<Bundle>> {
        roots.iter().map(|root| worker.stylesheet(root)).collect()
    }
    /// Run all jobs, retaining authored route order and every failure.
    fn run(&self, routes: &[String], worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>>;
}

/// Machine-sized dedicated render pool, independent of global Rayon settings.
pub struct ThreadWorkers {
    pool: rayon::ThreadPool,
}

impl ThreadWorkers {
    /// Start a bounded worker pool; zero is normalized to one.
    pub fn new(count: usize) -> Result<Self> {
        match rayon::ThreadPoolBuilder::new()
            .num_threads(count.max(1))
            .thread_name(|index| format!("mokly-render-{index}"))
            .build()
        {
            Ok(pool) => Ok(Self { pool }),
            Err(source) => Err(InternalError::Workers { source }.into()),
        }
    }
}

impl RenderWorkers for ThreadWorkers {
    fn comparison_parallelism(&self) -> usize {
        self.pool.current_num_threads()
    }
    fn comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        let parent = tracing::Span::current();
        self.pool.install(|| {
            routes
                .par_iter()
                .map(|route| parent.in_scope(|| worker.input(route)))
                .collect()
        })
    }
    fn closure(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Closure> {
        let parent = tracing::Span::current();
        self.pool
            .install(|| parent.in_scope(|| worker.closure_job(route)))
    }
    fn document(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Arc<Artifact>> {
        let parent = tracing::Span::current();
        self.pool
            .install(|| parent.in_scope(|| worker.artifact(route)))
    }
    fn stylesheets(
        &self,
        roots: &[StylesheetRoot],
        worker: &dyn StylesheetWorker,
    ) -> Result<Vec<Bundle>> {
        let parent = tracing::Span::current();
        let failed = AtomicUsize::new(usize::MAX);
        let results: Vec<_> = self.pool.install(|| {
            roots
                .par_iter()
                .enumerate()
                .map(|(index, root)| {
                    if index > failed.load(Ordering::Relaxed) {
                        return None;
                    }
                    let result = parent.in_scope(|| worker.stylesheet(root));
                    if result.is_err() {
                        failed.fetch_min(index, Ordering::Relaxed);
                    }
                    Some(result)
                })
                .collect()
        });
        // A skipped root always follows a failed one, so that failure returns first.
        results.into_iter().flatten().collect()
    }
    fn run(&self, routes: &[String], worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>> {
        let parent = tracing::Span::current();
        self.pool.install(|| {
            routes
                .par_iter()
                .map(|route| parent.in_scope(|| worker.validate(route)))
                .collect()
        })
    }
}

/// Stop preparation before the next entry or stylesheet starts.
pub(crate) fn check_cancelled(workers: &dyn RenderWorkers) -> Result<()> {
    if workers.cancelled() {
        Err(GraphError::Runtime {
            source: RuntimeDiagnostic {
                code: RuntimeCode::Cancelled,
                message: "build cancelled".into(),
            },
        })
    } else {
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/comparison_workers_tests.rs"]
mod comparison_workers_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_workers_tests.rs"]
mod stylesheet_workers_tests;
