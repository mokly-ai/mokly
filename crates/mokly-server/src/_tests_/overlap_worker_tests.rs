//! An admitted handoff releases dispatch while stop still owns completion.

use std::future::Future;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::task::{Context, Waker};

use mokly_graph::write_activity::{WriteActivityMock, WriteLease};
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background_capacity::FixedCapacity;
use crate::background_dispatch::Dispatch;
use crate::background_stage::Stages;
use crate::background_support::staged;
use crate::error::{InternalError, ServerError};
use crate::work::{Work, Workers};

#[derive(Default)]
struct Activity {
    entered: AtomicUsize,
    released: AtomicUsize,
}
impl Activity {
    fn state(&self) -> (usize, usize) {
        (
            self.entered.load(Ordering::SeqCst),
            self.released.load(Ordering::SeqCst),
        )
    }
}

struct Lease(Arc<Activity>);
impl WriteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.0.released.fetch_add(1, Ordering::SeqCst);
    }
}

struct Release(Arc<(Mutex<bool>, Condvar)>);
impl Drop for Release {
    fn drop(&mut self) {
        *self.0.0.lock().unwrap() = true;
        self.0.1.notify_all();
    }
}

#[tokio::test]
async fn admitted_root_releases_dispatch_before_document_completion() {
    let gate = Arc::new((Mutex::new(false), Condvar::new()));
    let cleanup = Release(gate.clone());
    let (sent, received) = oneshot::channel();
    let sent = Mutex::new(Some(sent));
    let mock = Unimock::new(
        DocumentsMock::background_read
            .some_call(matching!(_))
            .answers_arc(staged(Arc::new({
                let gate = gate.clone();
                move |_, _, completion| {
                    completion.handoff(128);
                    sent.lock().unwrap().take().unwrap().send(()).unwrap();
                    let mut open = gate.0.lock().unwrap();
                    while !*open {
                        open = gate.1.wait(open).unwrap();
                    }
                    Ok(Vec::new())
                }
            }))),
    );
    let documents = Arc::new(mock.clone());
    let workers = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let stages = Stages::new(Arc::new(FixedCapacity(1)));
    let job = tokio::spawn({
        let workers = workers.clone();
        async move {
            workers
                .background(documents, "one".into(), Dispatch::new(stages))
                .await
        }
    });
    received.await.unwrap();
    assert_eq!(
        workers.workers.available_permits(),
        1,
        "completion must return the one dispatch permit"
    );
    drop(cleanup);
    job.await.unwrap().unwrap();
    workers.stop().await;
}

#[tokio::test]
async fn handed_off_job_releases_its_charge_on_error_and_unwind_with_stage_still_retained() {
    for unwind in [false, true] {
        let stages = Stages::new(Arc::new(FixedCapacity(1)));
        let dispatch = Dispatch::new(stages.clone());
        let retained = Arc::new(Mutex::new(None));
        let mock = Unimock::new(
            DocumentsMock::background_read
                .some_call(matching!(_))
                .answers_arc(staged(Arc::new({
                    let dispatch = dispatch.clone();
                    let retained = retained.clone();
                    move |_, _, completion| {
                        *retained.lock().unwrap() = dispatch.stage.get().unwrap().upgrade();
                        completion.handoff(128);
                        if unwind {
                            panic!("injected background unwind");
                        }
                        Err(ServerError::Deadline)
                    }
                }))),
        );
        let documents = Arc::new(mock.clone());
        let work = Workers::new(1, Arc::new(Unimock::new(())));
        let error = work
            .background(documents, "error".into(), dispatch)
            .await
            .unwrap_err();
        let unwound = match error {
            ServerError::Deadline => false,
            ServerError::Internal(InternalError::Task { source }) => source.is_panic(),
            other => panic!("unexpected failure: {other}"),
        };
        assert_eq!(unwound, unwind);
        assert_eq!(*stages.bytes.lock().unwrap(), 0);
        assert_eq!(work.workers.available_permits(), 1);
        let stage = retained.lock().unwrap().take().unwrap();
        assert!(stage.state.lock().unwrap().charge.is_none());
        assert_eq!(*stages.active.lock().unwrap(), 0);
        work.stop().await;
    }
}

#[tokio::test]
async fn refused_charge_keeps_its_worker_and_cancelled_owner_returns_charge_at_finish() {
    let gate = Arc::new((Mutex::new(false), Condvar::new()));
    let cleanup = Release(gate.clone());
    let (sent, mut received) = tokio::sync::mpsc::unbounded_channel();
    let calls = Arc::new(AtomicUsize::new(0));
    let mock = Unimock::new(
        DocumentsMock::background_read
            .each_call(matching!(_))
            .answers_arc(staged(Arc::new({
                let gate = gate.clone();
                let calls = calls.clone();
                move |_, route, completion| {
                    calls.fetch_add(1, Ordering::SeqCst);
                    completion.handoff(if route == "first" {
                        4 * 1024 * 1024
                    } else {
                        128
                    });
                    sent.send(route.to_owned()).unwrap();
                    let mut open = gate.0.lock().unwrap();
                    while !*open {
                        open = gate.1.wait(open).unwrap();
                    }
                    Ok(Vec::new())
                }
            }))),
    );
    let documents = Arc::new(mock.clone());
    let observed = Arc::new(Activity::default());
    let activity = Unimock::new(WriteActivityMock::enter.each_call(matching!()).answers_arc(
        Arc::new({
            let observed = observed.clone();
            move |_| {
                observed.entered.fetch_add(1, Ordering::SeqCst);
                Box::new(Lease(observed.clone()))
            }
        }),
    ));
    let work = Arc::new(
        Workers::new(2, Arc::new(Unimock::new(()))).with_activity(Some(Arc::new(activity.clone()))),
    );
    let stages = Stages::new(Arc::new(FixedCapacity(2)));
    let first_dispatch = Dispatch::new(stages.clone());
    let second_dispatch = Dispatch::new(stages.clone());
    let mut first = Box::pin({
        let work = work.clone();
        let documents = documents.clone();
        let dispatch = first_dispatch.clone();
        async move { work.background(documents, "first".into(), dispatch).await }
    });
    {
        let _turn = work.turn.acquire().await.unwrap();
        assert!(
            first
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop()))
                .is_pending()
        );
        assert_eq!(
            observed.state(),
            (1, 0),
            "queued staged work must suppress writer admission before its fair turn"
        );
    }
    let first = tokio::spawn(first);
    assert_eq!(received.recv().await.unwrap(), "first");
    let first_stage = first_dispatch.stage.get().unwrap().upgrade().unwrap();
    assert_eq!(observed.state(), (1, 0));
    let second = tokio::spawn({
        let work = work.clone();
        let documents = documents.clone();
        let dispatch = second_dispatch.clone();
        async move { work.background(documents, "second".into(), dispatch).await }
    });
    assert_eq!(received.recv().await.unwrap(), "second");
    let second_stage = second_dispatch.stage.get().unwrap().upgrade().unwrap();
    assert!(first_stage.handed_off());
    assert!(!second_stage.handed_off());
    assert_eq!(work.workers.available_permits(), 1);
    assert_eq!(*stages.bytes.lock().unwrap(), 4 * 1024 * 1024);
    assert_eq!(observed.state(), (2, 0));
    first.abort();
    assert!(first.await.unwrap_err().is_cancelled());
    assert_eq!(
        observed.state(),
        (2, 0),
        "cancelling the handoff waiter must retain both physical jobs' activity"
    );
    assert_eq!(*stages.bytes.lock().unwrap(), 4 * 1024 * 1024);
    drop(cleanup);
    second.await.unwrap().unwrap();
    work.stop().await;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(*stages.bytes.lock().unwrap(), 0);
    assert_eq!(observed.state(), (2, 2));
}
