//! Parallel document validation with deterministic result order.

use std::collections::BTreeSet;
use std::fmt;
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_html::links::Reference;
use rayon::prelude::*;

use crate::cache::Artifact;
use crate::closure::Closure;
use crate::error::{InternalError, Result};

/// A document action that can run on a worker's large stack.
pub trait ArtifactWorker: Send + Sync {
    /// Compose and validate one document without scheduling another worker.
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>>;
    /// Collect a closure on the worker without changing its stack context.
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

/// Worker scheduling is an injectable runtime boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenderWorkersMock))]
pub trait RenderWorkers: Send + Sync {
    /// Collect an on-demand closure on the large render stack.
    fn closure(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Closure> {
        worker.closure_job(route)
    }
    /// Render an on-demand document on the same stack as complete builds.
    fn document(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Arc<Artifact>> {
        worker.artifact(route)
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
            .stack_size(64 * 1024 * 1024)
            .thread_name(|index| format!("mokly-render-{index}"))
            .build()
        {
            Ok(pool) => Ok(Self { pool }),
            Err(source) => Err(InternalError::Workers { source }.into()),
        }
    }
}

impl RenderWorkers for ThreadWorkers {
    fn closure(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Closure> {
        self.pool.install(|| worker.closure_job(route))
    }
    fn document(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Arc<Artifact>> {
        self.pool.install(|| worker.artifact(route))
    }
    fn run(&self, routes: &[String], worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>> {
        self.pool.install(|| {
            routes
                .par_iter()
                .map(|route| worker.validate(route))
                .collect()
        })
    }
}
