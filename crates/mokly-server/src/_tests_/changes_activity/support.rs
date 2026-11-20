//! Shared activity observations and background composition for probe regressions.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, mpsc};

use mokly_graph::write_activity::{WriteActivity, WriteActivityMock, WriteLease};
use unimock::{MockFn, Unimock, matching};

use crate::changes::ChangeSource;
use crate::changes_background::{AfterUsage, ChangesPass};
use crate::comparison_store::Comparisons;
use crate::comparison_support::snapshot;
use crate::publication::SharedPublication;
use crate::snapshot::Snapshot;

/// Active leases and completed releases expose gaps in activity ownership.
#[derive(Default)]
pub(super) struct Counts {
    active: AtomicUsize,
    released: AtomicUsize,
}

impl Counts {
    /// Observe the number of retained leases and previous releases.
    pub(super) fn state(&self) -> (usize, usize) {
        (
            self.active.load(Ordering::SeqCst),
            self.released.load(Ordering::SeqCst),
        )
    }
}

struct Lease(Arc<Counts>);
impl WriteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.0.active.fetch_sub(1, Ordering::SeqCst);
        self.0.released.fetch_add(1, Ordering::SeqCst);
    }
}

/// Keep the original mock on the test thread while clones serve background work.
pub(super) fn activity(counts: Arc<Counts>) -> Unimock {
    Unimock::new(
        WriteActivityMock::enter
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                counts.active.fetch_add(1, Ordering::SeqCst);
                Box::new(Lease(counts.clone()))
            })),
    )
}

/// Failure cleanup releases a blocked collaborator before runtime shutdown.
pub(super) struct Release(
    /// The test can release work before its cleanup guard ends.
    pub(super) mpsc::Sender<()>,
);
impl Drop for Release {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}

/// Run the public Changes API against one real publication owner.
pub(super) fn setup(
    source: Arc<dyn ChangeSource>,
    activity: Arc<dyn WriteActivity>,
    comparisons: Arc<dyn Comparisons>,
) -> (Arc<dyn AfterUsage>, Arc<Snapshot>, Arc<SharedPublication>) {
    let mut origin = (*snapshot(None)).clone();
    Arc::make_mut(&mut origin.generation).changes = Some(source);
    let origin = Arc::new(origin);
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let pass = Arc::new(ChangesPass {
        publications: publications.clone(),
        comparisons,
        diagnostics: Arc::new(Unimock::new(())),
        activity: Some(activity),
        watching: true,
    });
    (pass, origin, publications)
}
