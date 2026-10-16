//! Cancellation checkpoints at source IO and between independently scheduled views.

use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::workers::{ArtifactWorker, DocumentWorker, RenderWorkers, ValidatedView};
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{Child, Node, SourceTree};

use crate::cancellation::Cancellation;

/// Source operations stop at their next boundary after interruption.
pub struct CancellableTree {
    /// Underlying working or historical source view.
    pub inner: Arc<dyn SourceTree>,
    /// Command cancellation state.
    pub cancellation: Arc<dyn Cancellation>,
}

impl CancellableTree {
    fn check(&self, path: &Path) -> mokly_source_interface::error::Result<()> {
        if self.cancellation.requested() {
            Err(SourceError::Io {
                operation: "cancelled",
                path: path.into(),
                source: io::Error::from(io::ErrorKind::Interrupted),
            })
        } else {
            Ok(())
        }
    }
}

impl SourceTree for CancellableTree {
    fn digest(&self, path: &Path) -> mokly_source_interface::error::Result<String> {
        self.check(path)?;
        self.inner.digest(path)
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
impl DocumentWorker for Jobs<'_> {
    fn validate(&self, route: &str) -> Result<ValidatedView> {
        check(self.cancellation)?;
        self.inner.validate(route)
    }
}
