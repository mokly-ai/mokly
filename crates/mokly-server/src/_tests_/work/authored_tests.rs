//! Contended authored reads leave a worker free for document delivery.

use std::collections::BTreeMap;
use std::future::Future;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::task::{Context, Wake, Waker};

use axum::body::Bytes;
use mokly_graph::types::RenderGenerationMock;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::backend::{Documents, DocumentsMock, GraphDocuments};
use crate::public_read::PublicReaderMock;
use crate::work::{Work, Workers};

use super::support::{BlockGate, cleanup, release};

struct WakeSignal(Notify);

impl Wake for WakeSignal {
    fn wake(self: Arc<Self>) {
        self.0.notify_one();
    }
}

fn wait_for_release(gate: &BlockGate) {
    let _released = gate
        .1
        .wait_while(gate.0.lock().unwrap(), |released| !*released)
        .unwrap();
}

#[tokio::test]
async fn a_waiting_authored_request_leaves_a_worker_for_a_frame() {
    let path = "assets/large.bin";
    let unused = Unimock::new(());
    let workers = Arc::new(Workers::new(2, Arc::new(unused.clone())));
    let started = Arc::new(Notify::new());
    let gate = Arc::new((Mutex::new(false), Condvar::new()));
    let _cleanup = cleanup(gate.clone());
    let membership_gate = Arc::new((Mutex::new(false), Condvar::new()));
    let _membership_cleanup = cleanup(membership_gate.clone());
    let opens = Arc::new(AtomicUsize::new(0));
    let reader = Unimock::new(
        PublicReaderMock::open
            .each_call(matching!("assets/large.bin"))
            .answers_arc({
                let started = started.clone();
                let gate = gate.clone();
                let opens = opens.clone();
                Arc::new(move |_, _| {
                    if opens.fetch_add(1, Ordering::SeqCst) == 0 {
                        started.notify_one();
                        wait_for_release(&gate);
                    }
                    None
                })
            })
            .n_times(2),
    );
    let generation = Unimock::new((
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::contains_public_file
            .each_call(matching!("assets/large.bin"))
            .answers_arc({
                let checks = AtomicUsize::new(0);
                let membership_gate = membership_gate.clone();
                Arc::new(move |_, _| {
                    if checks.fetch_add(1, Ordering::SeqCst) == 1 {
                        wait_for_release(&membership_gate);
                    }
                    true
                })
            })
            .n_times(2),
    ));
    let documents: Arc<dyn Documents> = Arc::new(GraphDocuments::new(
        Arc::new(generation.clone()),
        Arc::new(reader.clone()),
        Arc::new(unused.clone()),
        Arc::new(unused.clone()),
    ));
    let first = {
        let workers = workers.clone();
        let documents = documents.clone();
        tokio::spawn(async move { workers.authored(documents, path.into()).await })
    };
    started.notified().await;
    let mut second = Box::pin(workers.authored(documents, path.into()));
    let checked = Arc::new(WakeSignal(Notify::new()));
    let waker = Waker::from(checked.clone());
    assert!(
        second
            .as_mut()
            .poll(&mut Context::from_waker(&waker))
            .is_pending()
    );
    assert_eq!(
        workers.workers.available_permits(),
        1,
        "the same-route waiter must leave one worker for the frame"
    );
    release(&membership_gate);
    checked.0.notified().await;
    assert!(
        second
            .as_mut()
            .poll(&mut Context::from_waker(&waker))
            .is_pending()
    );
    assert_eq!(
        workers.workers.available_permits(),
        1,
        "the route gate must keep the worker free after the membership check"
    );

    let frame = Unimock::new(
        DocumentsMock::generated
            .some_call(matching!("home/index.html"))
            .returns(Ok(Some(File {
                bytes: Bytes::from_static(b"<h1>Home</h1>"),
                content_type: "text/html; charset=utf-8".into(),
            }))),
    );
    let file = workers
        .generated(Arc::new(frame.clone()), "home/index.html".into())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(file.bytes.as_ref(), b"<h1>Home</h1>");
    assert_eq!(opens.load(Ordering::SeqCst), 1);

    release(&gate);
    assert!(first.await.unwrap().unwrap().is_none());
    assert!(second.await.unwrap().is_none());
    assert_eq!(opens.load(Ordering::SeqCst), 2);
}
