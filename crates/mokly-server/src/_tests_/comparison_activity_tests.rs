//! Queued and detached captures suppress optional writes through their actual lifetime.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_graph::write_activity::{WriteActivityMock, WriteLease};
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::clock::ClockMock;
use crate::comparison_capture::CapturerMock;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{historical, snapshot};
use crate::publication::SharedPublication;

struct Lease(Arc<AtomicUsize>);
impl WriteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}
struct Release(mpsc::Sender<()>);
impl Drop for Release {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}

#[tokio::test]
async fn queued_captures_keep_suppression_after_request_cancellation_and_release_on_stop() {
    let active = Arc::new(AtomicUsize::new(0));
    let queued = Arc::new(Notify::new());
    let current = active.clone();
    let observed = queued.clone();
    let activity = Unimock::new(WriteActivityMock::enter.some_call(matching!()).answers_arc(
        Arc::new(move |_| {
            if current.fetch_add(1, Ordering::SeqCst) == 2 {
                observed.notify_one();
            }
            Box::new(Lease(current.clone()))
        }),
    ));
    let started = Arc::new(Notify::new());
    let entered = started.clone();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let calls = Arc::new(AtomicUsize::new(0));
    let captured = calls.clone();
    let capture = Unimock::new(
        CapturerMock::capture
            .some_call(matching!(_, _, false, _))
            .answers_arc(Arc::new(move |_, _, _, _, _| {
                if captured.fetch_add(1, Ordering::SeqCst) == 0 {
                    entered.notify_one();
                    released.lock().unwrap().recv().unwrap();
                }
                Ok(BTreeMap::new())
            })),
    );
    let accepted = historical();
    let publications = Arc::new(SharedPublication::new(snapshot(Some(accepted.clone()))));
    let store = Arc::new(
        MemoryComparisons::new(
            Arc::new(Unimock::new(
                ClockMock::milliseconds.each_call(matching!()).returns(0u64),
            )),
            Arc::new(Unimock::new(())),
            Arc::new(capture.clone()),
            publications,
            Arc::new(Unimock::new(())),
        )
        .with_activity(Some(Arc::new(activity.clone()))),
    );
    let first = {
        let store = store.clone();
        let accepted = accepted.clone();
        tokio::spawn(async move { store.selected(accepted, "first".into(), false).await })
    };
    let release = Release(release);
    started.notified().await;
    assert_eq!(active.load(Ordering::SeqCst), 2);
    let second = {
        let store = store.clone();
        let accepted = accepted.clone();
        tokio::spawn(async move { store.selected(accepted, "second".into(), false).await })
    };
    queued.notified().await;
    assert_eq!(
        active.load(Ordering::SeqCst),
        3,
        "capture admission must retain the queued request's activity"
    );
    first.abort();
    second.abort();
    assert!(first.await.unwrap_err().is_cancelled());
    assert!(second.await.unwrap_err().is_cancelled());
    assert_eq!(active.load(Ordering::SeqCst), 3);
    release.0.send(()).unwrap();
    store.stop().await;
    assert_eq!(active.load(Ordering::SeqCst), 0);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
