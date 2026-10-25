//! A capture keeps its span when a thread without a capture registers the callsite first.

use std::sync::mpsc;
use std::thread;

use super::Trace;

/// One callsite that no other test uses, so this test controls its first registration.
fn probe() {
    let _span = tracing::info_span!("trace_capture.probe").entered();
}

#[test]
fn a_callsite_first_registered_without_a_capture_still_reaches_the_capture() {
    let trace = Trace::default();
    let (scoped, ready) = mpsc::channel();
    let (registered, first) = mpsc::channel();
    let capture = thread::spawn({
        let trace = trace.clone();
        move || {
            tracing::subscriber::with_default(trace, || {
                scoped.send(()).unwrap();
                first.recv().unwrap();
                probe();
            });
        }
    });
    ready.recv().unwrap();
    probe();
    registered.send(()).unwrap();
    capture.join().unwrap();
    assert_eq!(trace.closed("trace_capture.probe").len(), 1);
}
