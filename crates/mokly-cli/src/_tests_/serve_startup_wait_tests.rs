//! Classification cancellation and moved keys preserve independent startup drain.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_compare::base_startup::PreparedOutcome;
use mokly_compare::error::Error;
use mokly_graph::types::RenderGeneration;
use mokly_server::changes::{ChangeCancellation, ChangeCancellationMock, ChangeToken};
use mokly_server::changes_signal::{ChangeSignal, ChangeSignalMock};
use unimock::{MockFn, Unimock, matching};

use crate::serve_startup_base::{StartupHandoff, StartupReady, StartupState};
use crate::warning_support::warning;

use super::serve_startup_base_tests::key;

#[test]
fn a_moved_key_cancels_and_drains_before_discarding_held_diagnostics() {
    let state: Arc<dyn StartupHandoff> = Arc::new(StartupState::default());
    let head: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
    let startup = Arc::new(ChangeToken::default());
    let events = Arc::new(Mutex::new(Vec::new()));
    let (send, receive) = mpsc::channel();
    let cancelled = Mutex::new(Some(send.clone()));
    let cancellation_events = events.clone();
    let signal: Arc<dyn ChangeSignal> = Arc::new(
        Unimock::new(
            ChangeSignalMock::notify
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    if let Some(cancelled) = cancelled.lock().unwrap().take() {
                        cancellation_events.lock().unwrap().push("cancelled");
                        let _ = cancelled.send("cancelled");
                    }
                })),
        )
        .no_verify_in_drop(),
    );
    startup.observe(Arc::downgrade(&signal));
    let began = state.begin(head.clone(), startup.clone());
    let old_key = key('a', head.as_ref());
    state.selected(old_key.clone());
    let selected = key('b', head.as_ref());
    let after_cancel = Arc::new(AtomicBool::new(false));
    let current_events = events.clone();
    let current_send = send.clone();
    let current_startup = startup.clone();
    let caller = Unimock::new(
        ChangeCancellationMock::cancelled
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                if current_startup.cancelled() && !after_cancel.swap(true, Ordering::SeqCst) {
                    current_events.lock().unwrap().push("waiting");
                    let _ = current_send.send("waiting");
                }
                false
            })),
    )
    .no_verify_in_drop();
    let waiter = state.clone();
    let waiting_head = head.clone();
    let waiting_caller = caller.clone();
    let returned_events = events.clone();
    let waiting = std::thread::spawn(move || {
        let result = waiter.take(&selected, &waiting_head, &waiting_caller);
        returned_events.lock().unwrap().push("continued");
        let _ = send.send("continued");
        result
    });
    let cancelled_before_drain = receive.recv().unwrap();
    let next = if cancelled_before_drain == "cancelled" {
        Some(receive.recv().unwrap())
    } else {
        None
    };
    state.complete(StartupReady {
        result: Ok(PreparedOutcome::Retained),
        warnings: vec![warning("obsolete warning")],
        cache: Some("/obsolete-cache".into()),
        lifetime: None,
    });
    events.lock().unwrap().push("drained");
    state.finished();
    let rejected = waiting.join().unwrap().unwrap();
    let replay = state
        .take(&old_key, &head, &ChangeToken::default())
        .unwrap();
    assert!(began);
    assert_eq!(cancelled_before_drain, "cancelled");
    assert_eq!(next, Some("waiting"));
    assert_eq!(
        *events.lock().unwrap(),
        ["cancelled", "waiting", "drained", "continued"]
    );
    assert!(startup.cancelled());
    assert!(rejected.is_none());
    assert!(replay.is_none());
}

#[test]
fn an_ordinary_wait_cancels_without_joining_the_independent_startup_owner() {
    let state: Arc<dyn StartupHandoff> = Arc::new(StartupState::default());
    let head: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
    state.begin(head.clone(), Arc::new(ChangeToken::default()));
    let selected = key('a', head.as_ref());
    state.selected(selected.clone());
    let cancelled = Arc::new(AtomicBool::new(false));
    let caller_cancelled = cancelled.clone();
    let (observed, observing) = mpsc::channel();
    let returned = observed.clone();
    let observed = Mutex::new(Some(observed));
    let caller = Unimock::new((
        ChangeCancellationMock::observe
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, signal| {
                observed
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(Some(signal))
                    .unwrap();
            })),
        ChangeCancellationMock::cancelled
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| caller_cancelled.load(Ordering::SeqCst))),
    ))
    .no_verify_in_drop();
    let waiter = state.clone();
    let waiting_caller = caller.clone();
    let waiting_head = head.clone();
    let waiting = std::thread::spawn(move || {
        let result = waiter.take(&selected, &waiting_head, &waiting_caller);
        let _ = returned.send(None);
        result
    });
    let signal = observing
        .recv()
        .ok()
        .flatten()
        .and_then(|signal| signal.upgrade());
    cancelled.store(true, Ordering::SeqCst);
    if let Some(signal) = &signal {
        signal.notify();
    }
    let result = waiting.join().unwrap();
    state.finished();
    assert!(signal.is_some());
    assert!(matches!(result, Err(Error::Cancelled)));
}
