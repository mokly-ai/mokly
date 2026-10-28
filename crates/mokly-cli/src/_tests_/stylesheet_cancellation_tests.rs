//! Cancellable workers forward stylesheet roots and stop the jobs after an interrupt.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_graph::error::{GraphError, Result};
use mokly_graph::workers::{RenderWorkers, RenderWorkersMock, StylesheetWorker};
use mokly_model::runtime_diagnostic::RuntimeCode;
use mokly_sidecar::workers::ClockMock;
use unimock::{MockFn, Unimock, matching};

use crate::cancellation::{BuildCancellation, Cancellation};
use crate::cancelled_work::CancellableWorkers;

struct InterruptingJob {
    cancellation: Arc<dyn Cancellation>,
    completed: AtomicUsize,
}

impl StylesheetWorker for InterruptingJob {
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle> {
        self.completed.fetch_add(1, Ordering::Relaxed);
        assert!(!self.cancellation.interrupt());
        Ok(Bundle {
            read_evidence: Default::default(),
            route: format!("styles/{}", root.path),
            css: String::new(),
            assets: BTreeMap::new(),
            css_modules: BTreeMap::new(),
            inputs: BTreeMap::new(),
            imported_by: BTreeMap::new(),
            repository_aliases: BTreeSet::new(),
            dependency_digests: BTreeMap::new(),
            plugin_inputs: BTreeMap::new(),
            directories: Vec::new(),
        })
    }
}

fn root(path: &str) -> StylesheetRoot {
    StylesheetRoot {
        path: path.into(),
        stylesheets: vec![path.into()],
        excluded: BTreeSet::new(),
        local_css: true,
    }
}

#[test]
fn stylesheet_roots_reach_the_inner_workers_and_stop_after_the_first_interrupt() {
    let cancellation: Arc<dyn Cancellation> = Arc::new(BuildCancellation::new(Arc::new(
        Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(0_u64)),
    )));
    let job = InterruptingJob {
        cancellation: cancellation.clone(),
        completed: AtomicUsize::new(0),
    };
    let scheduler: &dyn RenderWorkers = &CancellableWorkers {
        cancellation,
        inner: Arc::new(Unimock::new(
            RenderWorkersMock::stylesheets
                .next_call(matching!(_, _))
                .answers(&|_, roots, worker| {
                    assert_eq!(roots.len(), 3);
                    roots.iter().map(|root| worker.stylesheet(root)).collect()
                }),
        )),
    };
    let result = scheduler.stylesheets(&[root("a.css"), root("b.css"), root("c.css")], &job);
    assert!(matches!(
        result,
        Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled
    ));
    assert_eq!(job.completed.load(Ordering::Relaxed), 1);
}
