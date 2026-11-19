//! An admitted handoff releases dispatch while stop still owns completion.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use mokly_graph::cache_lease::ByteLease;
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background_capacity::FixedCapacity;
use crate::background_stage::Stages;
use crate::error::{InternalError, ServerError};
use crate::work::{Work, Workers};

struct Lease;
impl ByteLease for Lease {}

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
        DocumentsMock::background_staged
            .some_call(matching!(_, _))
            .answers_arc(Arc::new({
                let gate = gate.clone();
                move |_, _, completion| {
                    completion.handoff(Box::new(Lease));
                    sent.lock().unwrap().take().unwrap().send(()).unwrap();
                    let mut open = gate.0.lock().unwrap();
                    while !*open {
                        open = gate.1.wait(open).unwrap();
                    }
                    Ok(Vec::new())
                }
            })),
    );
    let documents = Arc::new(mock.clone());
    let workers = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let stages = Stages::new(Arc::new(FixedCapacity(1)));
    let job = tokio::spawn({
        let workers = workers.clone();
        async move {
            workers
                .background_staged(documents, "one".into(), stages.view("one"))
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

struct DropLease(Arc<AtomicUsize>);
impl ByteLease for DropLease {}
impl Drop for DropLease {
    fn drop(&mut self) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
}

#[tokio::test]
async fn handed_off_job_releases_its_lease_on_error_and_unwind_with_stage_still_retained() {
    for unwind in [false, true] {
        let released = Arc::new(AtomicUsize::new(0));
        let mock = Unimock::new(
            DocumentsMock::background_staged
                .some_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let released = released.clone();
                    move |_, _, completion| {
                        completion.handoff(Box::new(DropLease(released.clone())));
                        if unwind {
                            panic!("injected background unwind");
                        }
                        Err(ServerError::Deadline)
                    }
                })),
        );
        let documents = Arc::new(mock.clone());
        let work = Workers::new(1, Arc::new(Unimock::new(())));
        let stages = Stages::new(Arc::new(FixedCapacity(1)));
        let stage = stages.view("error");
        let error = work
            .background_staged(documents, "error".into(), stage.clone())
            .await
            .unwrap_err();
        let unwound = match error {
            ServerError::Deadline => false,
            ServerError::Internal(InternalError::Task { source }) => source.is_panic(),
            other => panic!("unexpected failure: {other}"),
        };
        assert_eq!(unwound, unwind);
        assert_eq!(released.load(Ordering::SeqCst), 1);
        assert_eq!(work.workers.available_permits(), 1);
        assert!(stage.state.lock().unwrap().lease.is_none());
        assert_eq!(*stages.active.lock().unwrap(), 0);
        work.stop().await;
    }
}
