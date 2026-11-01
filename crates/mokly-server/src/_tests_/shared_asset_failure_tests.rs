//! Every request waiting for one failed capture receives its original typed failure.

use std::collections::BTreeMap;
use std::ptr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Condvar, Mutex, mpsc};
use std::task::{Context, Waker};
use std::thread;

use mokly_graph::asset_delivery::AssetRead;
use mokly_graph::closure::GeneratedResourcesMock;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::asset_streams::AssetStreamsMock;
use crate::backend::{Documents, GraphDocuments};
use crate::error::ServerError;
use crate::work::{Work, Workers};

#[test]
fn failed_capture_is_shared_by_every_waiting_request() {
    let fixture = CaptureFailure::new();
    let attempts = fixture.attempts.clone();
    let documents = fixture.documents.clone();
    let gate = fixture.gate.clone();
    let entered = &fixture.entered;
    let start = Barrier::new(9);
    let reservations: Vec<_> = (0..8)
        .map(|_| documents.asset_request("assets/css/opaque.svg"))
        .collect();
    let errors = thread::scope(|scope| {
        let requests: Vec<_> = reservations
            .into_iter()
            .map(|reservation| {
                let start = &start;
                scope.spawn(move || {
                    start.wait();
                    reservation.capture().err().unwrap()
                })
            })
            .collect();
        start.wait();
        entered.recv().unwrap();
        *gate.0.lock().unwrap() = true;
        gate.1.notify_all();
        requests
            .into_iter()
            .map(|request| request.join().unwrap())
            .collect::<Vec<_>>()
    });
    for error in &errors {
        assert_changed(error);
    }
    assert_eq!(attempts.load(Ordering::SeqCst), 1);
    let first: &ServerError = &errors[0];
    for error in errors.iter().skip(1) {
        let error: &ServerError = error;
        assert!(ptr::eq(first, error));
    }
}

#[tokio::test]
async fn queued_asset_requests_keep_one_capture_after_the_first_call_finishes() {
    let fixture = CaptureFailure::new();
    let work: Arc<dyn Work> = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let route = "assets/css/opaque.svg";
    let first = tokio::spawn({
        let work = work.clone();
        let documents = fixture.documents.clone();
        async move { work.asset(documents, route.into()).await }
    });
    fixture.capturing.notified().await;
    let mut queued: Vec<_> = (0..7)
        .map(|_| work.asset(fixture.documents.clone(), route.into()))
        .collect();
    let mut context = Context::from_waker(Waker::noop());
    for request in &mut queued {
        assert!(request.as_mut().poll(&mut context).is_pending());
    }
    fixture.release();
    let mut errors = vec![first.await.unwrap().err().unwrap()];
    for request in queued {
        errors.push(request.await.err().unwrap());
    }
    work.stop().await;
    for error in &errors {
        assert_changed(error);
    }
    assert_eq!(fixture.attempts.load(Ordering::SeqCst), 1);
    for error in errors.iter().skip(1) {
        assert!(Arc::ptr_eq(&errors[0], error));
    }
}

fn assert_changed(error: &ServerError) {
    assert!(matches!(error, ServerError::Render {
        source: GraphError::InputsChanged { path },
    } if path.to_str() == Some("css/opaque.svg")));
}

struct CaptureFailure {
    documents: Arc<dyn Documents>,
    attempts: Arc<AtomicUsize>,
    gate: Arc<(Mutex<bool>, Condvar)>,
    entered: mpsc::Receiver<()>,
    capturing: Arc<Notify>,
}

impl CaptureFailure {
    fn new() -> Self {
        let attempts = Arc::new(AtomicUsize::new(0));
        let gate = Arc::new((Mutex::new(false), Condvar::new()));
        let (started, entered) = mpsc::channel();
        let capturing = Arc::new(Notify::new());
        let capture_attempts = attempts.clone();
        let capture_gate = gate.clone();
        let capture_started = capturing.clone();
        let streams = Unimock::new(
            AssetStreamsMock::capture
                .each_call(matching!(_, "image/svg+xml"))
                .answers_arc(Arc::new(move |_, _, _| {
                    capture_attempts.fetch_add(1, Ordering::SeqCst);
                    started.send(()).unwrap();
                    capture_started.notify_one();
                    let (lock, changed) = capture_gate.as_ref();
                    let _released = changed
                        .wait_while(lock.lock().unwrap(), |ready| !*ready)
                        .unwrap();
                    Err(ServerError::Render {
                        source: GraphError::InputsChanged {
                            path: "css/opaque.svg".into(),
                        },
                    })
                })),
        );
        let generation = Unimock::new((
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(BTreeMap::new()),
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers(&|_| Ok(())),
            GeneratedResourcesMock::open_asset
                .each_call(matching!("assets/css/opaque.svg"))
                .answers(&|_, _| Ok(Some(Box::new(Unimock::new(())) as Box<dyn AssetRead>))),
        ));
        Self {
            documents: Arc::new(GraphDocuments::new(
                Arc::new(generation),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(streams),
            )),
            attempts,
            gate,
            entered,
            capturing,
        }
    }

    fn release(&self) {
        *self.gate.0.lock().unwrap() = true;
        self.gate.1.notify_all();
    }
}

impl Drop for CaptureFailure {
    fn drop(&mut self) {
        self.release();
    }
}
