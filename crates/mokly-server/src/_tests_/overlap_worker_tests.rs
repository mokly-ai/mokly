//! An admitted handoff releases dispatch while stop still owns completion.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background_capacity::FixedCapacity;
use crate::background_stage::Stages;
use crate::error::{InternalError, ServerError};
use crate::work::{Work, Workers};

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
                    completion.handoff(128);
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

#[tokio::test]
async fn handed_off_job_releases_its_charge_on_error_and_unwind_with_stage_still_retained() {
    for unwind in [false, true] {
        let mock = Unimock::new(
            DocumentsMock::background_staged
                .some_call(matching!(_, _))
                .answers_arc(Arc::new({
                    move |_, _, completion| {
                        completion.handoff(128);
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
        assert_eq!(*stages.bytes.lock().unwrap(), 0);
        assert_eq!(work.workers.available_permits(), 1);
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
        DocumentsMock::background_staged
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
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
            })),
    );
    let documents = Arc::new(mock.clone());
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let stages = Stages::new(Arc::new(FixedCapacity(2)));
    let first_stage = stages.view("first");
    let second_stage = stages.view("second");
    let first = tokio::spawn({
        let work = work.clone();
        let documents = documents.clone();
        let stage = first_stage.clone();
        async move {
            work.background_staged(documents, "first".into(), stage)
                .await
        }
    });
    assert_eq!(received.recv().await.unwrap(), "first");
    let second = tokio::spawn({
        let work = work.clone();
        let documents = documents.clone();
        let stage = second_stage.clone();
        async move {
            work.background_staged(documents, "second".into(), stage)
                .await
        }
    });
    assert_eq!(received.recv().await.unwrap(), "second");
    assert!(first_stage.handed_off());
    assert!(!second_stage.handed_off());
    assert_eq!(work.workers.available_permits(), 1);
    assert_eq!(*stages.bytes.lock().unwrap(), 4 * 1024 * 1024);
    first.abort();
    assert!(first.await.unwrap_err().is_cancelled());
    assert_eq!(*stages.bytes.lock().unwrap(), 4 * 1024 * 1024);
    drop(cleanup);
    second.await.unwrap().unwrap();
    work.stop().await;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(*stages.bytes.lock().unwrap(), 0);
}
