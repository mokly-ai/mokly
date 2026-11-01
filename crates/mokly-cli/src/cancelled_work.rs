//! Cancellation checkpoints at source IO and between independently scheduled views.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::types::ComparisonDocument;
use mokly_graph::workers::{
    ArtifactWorker, ComparisonWorker, DocumentWorker, RenderWorkers, StylesheetWorker,
    ValidatedView,
};
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::stream::SourceStream;
use mokly_source_interface::tree::{Child, Node, SourceTree};

use crate::cancellation::Cancellation;
use crate::cancelled_stream::CancellableStream;

/// Source operations stop at their next boundary after interruption.
/// Every method forwards to the inner tree, because the trait defaults would drop exact
/// prefetch sets, turn public reads and streams into plain reads, and hash by reading
/// whole files.
pub struct CancellableTree {
    /// Underlying working or historical source view.
    pub inner: Arc<dyn SourceTree>,
    /// Command cancellation state.
    pub cancellation: Arc<dyn Cancellation>,
}

impl CancellableTree {
    fn check(&self, path: &Path) -> mokly_source_interface::error::Result<()> {
        if self.cancellation.requested() {
            Err(SourceError::Cancelled { path: path.into() })
        } else {
            Ok(())
        }
    }
}

impl SourceTree for CancellableTree {
    fn file_object(&self, path: &Path) -> mokly_source_interface::error::Result<Option<String>> {
        self.check(path)?;
        self.inner.file_object(path)
    }

    fn observe_input(
        &self,
        path: &Path,
        baseline: &ReadBaseline,
    ) -> mokly_source_interface::error::Result<()> {
        self.check(path)?;
        self.inner.observe_input(path, baseline)
    }
    fn observe_inputs(
        &self,
        path: &Path,
        baselines: &BTreeSet<ReadBaseline>,
    ) -> mokly_source_interface::error::Result<()> {
        self.check(path)?;
        self.inner.observe_inputs(path, baselines)
    }
    fn observe_pinned_input(
        &self,
        path: &Path,
        baseline: &ReadBaseline,
        digest: Option<&str>,
    ) -> mokly_source_interface::error::Result<()> {
        self.check(path)?;
        self.inner.observe_pinned_input(path, baseline, digest)
    }
    fn prefetch(&self, paths: &[PathBuf]) -> mokly_source_interface::error::Result<()> {
        for path in paths {
            self.check(path)?;
        }
        self.inner.prefetch(paths)
    }
    fn read_public(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<u8>> {
        self.check(path)?;
        self.inner.read_public(path)
    }
    fn open_stream(
        &self,
        path: &Path,
    ) -> mokly_source_interface::error::Result<Box<dyn SourceStream>> {
        self.check(path)?;
        Ok(Box::new(CancellableStream {
            inner: self.inner.open_stream(path)?,
            cancellation: self.cancellation.clone(),
        }))
    }
    fn digest_unretained(&self, path: &Path) -> mokly_source_interface::error::Result<String> {
        self.check(path)?;
        self.inner.digest_unretained(path)
    }
    fn digest_unretained_batch(
        &self,
        paths: &[PathBuf],
    ) -> Vec<mokly_source_interface::error::Result<String>> {
        if paths.iter().any(|path| self.check(path).is_err()) {
            return paths
                .iter()
                .map(|path| {
                    self.check(path)
                        .and_then(|()| self.inner.digest_unretained(path))
                })
                .collect();
        }
        self.inner.digest_unretained_batch(paths)
    }
    fn digest(&self, path: &Path) -> mokly_source_interface::error::Result<String> {
        self.check(path)?;
        self.inner.digest(path)
    }
    fn project_batch(
        &self,
        paths: &[PathBuf],
    ) -> Vec<mokly_source_interface::error::Result<Option<Node>>> {
        if paths.iter().any(|path| self.check(path).is_err()) {
            return paths
                .iter()
                .map(|path| self.check(path).and_then(|()| self.inner.project(path)))
                .collect();
        }
        self.inner.project_batch(paths)
    }
    fn project(&self, path: &Path) -> mokly_source_interface::error::Result<Option<Node>> {
        self.check(path)?;
        self.inner.project(path)
    }
    fn children(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<Child>> {
        self.check(path)?;
        self.inner.children(path)
    }
    fn read(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<u8>> {
        self.check(path)?;
        self.inner.read(path)
    }
    fn read_shared(&self, path: &Path) -> mokly_source_interface::error::Result<Arc<[u8]>> {
        self.check(path)?;
        self.inner.read_shared(path)
    }
}

/// Scheduler wrapper checks each queued document before it starts.
pub struct CancellableWorkers {
    /// Normal preparation scheduler.
    pub inner: Arc<dyn RenderWorkers>,
    /// Command cancellation state.
    pub cancellation: Arc<dyn Cancellation>,
}

fn check(cancellation: &dyn Cancellation) -> Result<()> {
    if cancellation.requested() {
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

impl RenderWorkers for CancellableWorkers {
    fn comparison_parallelism(&self) -> usize {
        self.inner.comparison_parallelism()
    }
    fn comparison(
        &self,
        routes: &[String],
        worker: &dyn ComparisonWorker,
    ) -> Vec<Result<ComparisonDocument>> {
        self.inner.comparison(
            routes,
            &ComparisonJobs {
                cancellation: self.cancellation.as_ref(),
                inner: worker,
            },
        )
    }
    fn cancelled(&self) -> bool {
        self.cancellation.requested()
    }
    fn closure(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Closure> {
        check(self.cancellation.as_ref())?;
        self.inner.closure(route, worker)
    }
    fn document(&self, route: &str, worker: &dyn ArtifactWorker) -> Result<Arc<Artifact>> {
        check(self.cancellation.as_ref())?;
        self.inner.document(route, worker)
    }
    fn stylesheets(
        &self,
        roots: &[StylesheetRoot],
        worker: &dyn StylesheetWorker,
    ) -> Result<Vec<Bundle>> {
        self.inner.stylesheets(
            roots,
            &StylesheetJobs {
                cancellation: self.cancellation.as_ref(),
                inner: worker,
            },
        )
    }
    fn run(&self, routes: &[String], worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>> {
        self.inner.run(
            routes,
            &Jobs {
                cancellation: self.cancellation.as_ref(),
                inner: worker,
            },
        )
    }
}

struct Jobs<'a> {
    cancellation: &'a dyn Cancellation,
    inner: &'a dyn DocumentWorker,
}

struct ComparisonJobs<'a> {
    cancellation: &'a dyn Cancellation,
    inner: &'a dyn ComparisonWorker,
}

struct StylesheetJobs<'a> {
    cancellation: &'a dyn Cancellation,
    inner: &'a dyn StylesheetWorker,
}

impl StylesheetWorker for StylesheetJobs<'_> {
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle> {
        check(self.cancellation)?;
        self.inner.stylesheet(root)
    }
}

impl ComparisonWorker for ComparisonJobs<'_> {
    fn input(&self, route: &str) -> Result<ComparisonDocument> {
        check(self.cancellation)?;
        self.inner.input(route)
    }
}
impl DocumentWorker for Jobs<'_> {
    fn validate(&self, route: &str) -> Result<ValidatedView> {
        check(self.cancellation)?;
        self.inner.validate(route)
    }
}

#[cfg(test)]
#[path = "_tests_/comparison_cancellation_tests.rs"]
mod comparison_cancellation_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_cancellation_tests.rs"]
mod stylesheet_cancellation_tests;

#[cfg(test)]
#[path = "_tests_/projection_forwarding_tests.rs"]
mod projection_forwarding_tests;
