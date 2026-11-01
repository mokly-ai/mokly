//! Every request waiting for one failed capture receives its original typed failure.

use std::collections::BTreeMap;
use std::ptr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Condvar, Mutex, mpsc};
use std::thread;

use mokly_graph::asset_delivery::AssetRead;
use mokly_graph::closure::GeneratedResourcesMock;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::asset_streams::AssetStreamsMock;
use crate::backend::{Documents, GraphDocuments};
use crate::error::ServerError;

#[test]
fn failed_capture_is_shared_by_every_waiting_request() {
    let attempts = Arc::new(AtomicUsize::new(0));
    let gate = Arc::new((Mutex::new(false), Condvar::new()));
    let (started, entered) = mpsc::channel();
    let capture_attempts = attempts.clone();
    let capture_gate = gate.clone();
    let streams = Unimock::new(
        AssetStreamsMock::capture
            .each_call(matching!(_, "image/svg+xml"))
            .answers_arc(Arc::new(move |_, _, _| {
                capture_attempts.fetch_add(1, Ordering::SeqCst);
                started.send(()).unwrap();
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
    let documents = GraphDocuments::new(
        Arc::new(generation),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(streams),
    );
    let start = Barrier::new(9);
    let reservations: Vec<_> = (0..8)
        .map(|_| documents.asset_request("assets/css/opaque.svg"))
        .collect();
    let errors = thread::scope(|scope| {
        let requests: Vec<_> = reservations
            .into_iter()
            .map(|reservation| {
                let start = &start;
                let documents = &documents;
                scope.spawn(move || {
                    start.wait();
                    match reservation {
                        Some(request) => request.capture(),
                        None => documents.asset("assets/css/opaque.svg"),
                    }
                    .err()
                    .unwrap()
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

fn assert_changed(error: &ServerError) {
    assert!(matches!(error, ServerError::Render {
        source: GraphError::InputsChanged { path },
    } if path.to_str() == Some("css/opaque.svg")));
}
