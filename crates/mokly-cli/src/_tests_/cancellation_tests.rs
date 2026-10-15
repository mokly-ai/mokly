//! Event-order checks stop native jobs without a sidecar or elapsed-time assertion.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_graph::error::Result;
use mokly_graph::workers::{DocumentWorker, RenderWorkers, RenderWorkersMock, ValidatedView};
use mokly_sidecar::workers::ClockMock;
use mokly_source_interface::tree::SourceTree;
use unimock::{MockFn, Unimock, matching};

use crate::cancellation::{BuildCancellation, Cancellation};
use crate::cancelled_work::{CancellableTree, CancellableWorkers};

struct NativeJob {
    cancellation: Arc<dyn Cancellation>,
    completed: AtomicUsize,
}
impl DocumentWorker for NativeJob {
    fn validate(&self, route: &str) -> Result<ValidatedView> {
        self.completed.fetch_add(1, Ordering::Relaxed);
        assert!(!self.cancellation.interrupt());
        Ok(ValidatedView {
            route: route.into(),
            anchors: Default::default(),
            links: Vec::new(),
            closure: Default::default(),
            warnings: Vec::new(),
        })
    }
}

#[test]
fn an_html_only_build_stops_queued_views_after_the_first_interrupt() {
    let cancellation: Arc<dyn Cancellation> =
        Arc::new(BuildCancellation::new(Arc::new(Unimock::new((
            ClockMock::now_ms.next_call(matching!()).returns(0_u64),
            ClockMock::now_ms.next_call(matching!()).returns(1_000_u64),
        )))));
    let jobs = NativeJob {
        cancellation: cancellation.clone(),
        completed: AtomicUsize::new(0),
    };
    let scheduler: &dyn RenderWorkers = &CancellableWorkers {
        cancellation: cancellation.clone(),
        inner: Arc::new(Unimock::new(
            RenderWorkersMock::run
                .each_call(matching!(_, _))
                .answers(&|_, routes, worker| {
                    routes.iter().map(|route| worker.validate(route)).collect()
                }),
        )),
    };
    let results = scheduler.run(
        &[
            "a.html".into(),
            "b.html".into(),
            "c.html".into(),
            "d.html".into(),
        ],
        &jobs,
    );
    assert!(results[0].is_ok());
    assert!(results[1..].iter().all(Result::is_err));
    assert_eq!(jobs.completed.load(Ordering::Relaxed), 1);
    assert!(scheduler.cancelled());
    let tree: &dyn SourceTree = &CancellableTree {
        inner: Arc::new(Unimock::new(())),
        cancellation: cancellation.clone(),
    };
    assert!(tree.read(Path::new("/repo/later.screen.html")).is_err());
    assert!(
        cancellation.interrupt(),
        "the second signal requests an immediate exit"
    );
}

#[test]
fn forwarded_signal_copies_share_one_fixed_interrupt_interval() {
    let cancellation: &dyn Cancellation = &BuildCancellation::new(Arc::new(Unimock::new((
        ClockMock::now_ms.next_call(matching!()).returns(10_u64),
        ClockMock::now_ms.next_call(matching!()).returns(11_u64),
        ClockMock::now_ms.next_call(matching!()).returns(1_009_u64),
        ClockMock::now_ms.next_call(matching!()).returns(1_010_u64),
    ))));
    assert!(!cancellation.requested());
    for _ in 0..3 {
        assert!(!cancellation.interrupt());
        assert!(cancellation.requested());
    }
    assert!(
        cancellation.interrupt(),
        "the next interruption forces exit at the fixed boundary"
    );
}
