//! Early admission keeps no FIFO position, does not lose wakes, and yields each call.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex, Weak, mpsc};
use std::thread;
use std::time::Duration;

use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_server::changes_signal::ChangeSignal;
use mokly_server::foreground::Foreground;
use mokly_server::usage_completion::{UsageCompletion, UsageCompletionMock};
use mokly_sidecar::early_lease::{EarlyCall, EarlyLease, EarlyLeaseMock};
use mokly_sidecar::error::Error;
use mokly_sidecar::pool::{PoolMock, ReturnWake};
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::serve_early_wake::PreparationWakeMock;
use crate::serve_pool::{PoolScheduling, ServePool};
use crate::serve_pool_gate::{Gate, State};

use super::serve_pool_support::css;

fn usage(
    ready: Arc<AtomicBool>,
    observer: Arc<Mutex<Option<Weak<dyn ChangeSignal>>>>,
) -> Arc<dyn UsageCompletion> {
    Arc::new(Unimock::new((
        UsageCompletionMock::settled
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| ready.load(Ordering::Acquire))),
        UsageCompletionMock::observe
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, wake| {
                *observer.lock().unwrap() = Some(wake);
            })),
    )))
}

#[test]
fn a_capacity_notification_during_the_atomic_claim_is_not_lost() {
    let wake: Arc<Mutex<Option<Weak<dyn ReturnWake>>>> = Arc::new(Mutex::new(None));
    let captured = wake.clone();
    let notified = wake.clone();
    let calls = Arc::new(Mutex::new(0));
    let count = calls.clone();
    let inner = Unimock::new((
        PoolMock::observe_available
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, listener| {
                *captured.lock().unwrap() = Some(listener);
            })),
        PoolMock::try_early
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let mut calls = count.lock().unwrap();
                *calls += 1;
                if *calls == 1 {
                    notified
                        .lock()
                        .unwrap()
                        .as_ref()
                        .unwrap()
                        .upgrade()
                        .unwrap()
                        .notify();
                    Ok(None)
                } else {
                    let lease: Box<dyn EarlyLease> = Box::new(Unimock::new((
                        EarlyLeaseMock::request
                            .some_call(matching!(_))
                            .returns(EarlyCall::Complete(Ok(MethodResult::Empty))),
                        EarlyLeaseMock::finish
                            .some_call(matching!())
                            .returns(Ok(())),
                    )));
                    Ok(Some(lease))
                }
            })),
    ));
    let scheduler = ServePool::new(Arc::new(inner), 2);
    let base = scheduler.preparing(
        Arc::new(ChangeToken::default()),
        usage(Arc::new(AtomicBool::new(false)), Arc::new(Mutex::new(None))),
    );
    let result = base.request(css("/base", 0));
    base.finish();
    assert!(matches!(result, Ok(MethodResult::Empty)));
    assert_eq!(*calls.lock().unwrap(), 2);
    assert_eq!(scheduler.gate.state.lock().unwrap().active, 0);
}

#[test]
fn every_call_of_a_retained_early_lease_waits_for_the_whole_http_lease() {
    let (send, receive) = mpsc::channel();
    let waiting = send.clone();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let wake = Unimock::new((
        PreparationWakeMock::version
            .each_call(matching!())
            .returns(0_u64),
        PreparationWakeMock::wake.each_call(matching!()).returns(()),
        PreparationWakeMock::wait
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                waiting.send("wait").unwrap();
                released.lock().unwrap().recv().unwrap();
            })),
    ));
    let calls = Arc::new(Mutex::new(0));
    let counting = calls.clone();
    let inner = Unimock::new(
        PoolMock::try_early
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let counting = counting.clone();
                let send = send.clone();
                let lease: Box<dyn EarlyLease> = Box::new(Unimock::new((
                    EarlyLeaseMock::request
                        .each_call(matching!(_))
                        .answers_arc(Arc::new(move |_, _| {
                            let mut calls = counting.lock().unwrap();
                            *calls += 1;
                            if *calls == 2 {
                                send.send("call").unwrap();
                            }
                            EarlyCall::Complete(Ok(MethodResult::Empty))
                        }))
                        .n_times(2),
                    EarlyLeaseMock::finish
                        .some_call(matching!())
                        .returns(Ok(())),
                )));
                Ok(Some(lease))
            })),
    );
    let scheduler = ServePool {
        inner: Arc::new(inner),
        gate: Arc::new(Gate {
            state: Mutex::new(State::default()),
            changed: Condvar::new(),
            limit: 2,
            early_wake: Arc::new(wake),
            return_wake: Mutex::new(None),
            diagnostics: Mutex::new(None),
        }),
    };
    let base = scheduler.preparing(
        Arc::new(ChangeToken::default()),
        usage(Arc::new(AtomicBool::new(false)), Arc::new(Mutex::new(None))),
    );
    base.request(css("/base", 0)).unwrap();
    let http = scheduler.enter();
    let worker = base.clone();
    let call = thread::spawn(move || worker.request(css("/base", 1)));
    let first = receive.recv().unwrap();
    drop(http);
    release.send(()).unwrap();
    call.join().unwrap().unwrap();
    base.finish();
    assert_eq!(first, "wait");
    assert_eq!(*calls.lock().unwrap(), 2);
}

#[test]
fn cancellation_ends_early_admission_before_usage_settles() {
    let ready = Arc::new(AtomicBool::new(false));
    let observer = Arc::new(Mutex::new(None));
    let (missed, missing) = mpsc::channel();
    let (completed, completion) = mpsc::channel();
    let requests = Arc::new(Mutex::new(0));
    let calls = requests.clone();
    let inner = Unimock::new((
        PoolMock::try_early
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                missed.send(()).unwrap();
                Ok(None)
            })),
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                *calls.lock().unwrap() += 1;
                Ok(MethodResult::Empty)
            })),
    ))
    .no_verify_in_drop();
    let scheduler = ServePool::new(Arc::new(inner), 1);
    let cancel = Arc::new(ChangeToken::default());
    let base = scheduler.preparing(cancel.clone(), usage(ready.clone(), observer.clone()));
    let worker = base.clone();
    let call = thread::spawn(move || {
        completed.send(worker.request(css("/base", 0))).unwrap();
    });
    missing.recv().unwrap();
    cancel.cancel();
    let observed = completion.recv_timeout(Duration::from_secs(10));
    let admission = {
        let state = scheduler.gate.state.lock().unwrap();
        (state.active, state.waiting, state.waiting_base, state.http)
    };
    ready.store(true, Ordering::Release);
    if let Some(wake) = observer.lock().unwrap().as_ref().and_then(Weak::upgrade) {
        wake.notify();
    }
    call.join().unwrap();
    base.finish();
    assert!(
        matches!(observed, Ok(Err(Error::Cancelled))),
        "{observed:?}"
    );
    assert_eq!(admission, (0, 0, 0, 0));
    assert_eq!(*requests.lock().unwrap(), 0);
    assert_eq!(scheduler.gate.state.lock().unwrap().active, 0);
}

#[test]
fn an_unavailable_early_slot_waits_outside_admission_then_uses_ordinary_calls() {
    for already_settled in [false, true] {
        let ready = Arc::new(AtomicBool::new(already_settled));
        let observer = Arc::new(Mutex::new(None));
        let (missed, missing) = mpsc::channel();
        let tries = Arc::new(Mutex::new(0));
        let count = tries.clone();
        let admitted_signal = missed.clone();
        let ordinary = Arc::new(Mutex::new(0));
        let admitted = ordinary.clone();
        let inner = Unimock::new((
            PoolMock::try_early
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    *count.lock().unwrap() += 1;
                    missed.send("miss").unwrap();
                    Ok(None)
                })),
            PoolMock::request
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    *admitted.lock().unwrap() += 1;
                    admitted_signal.send("ordinary").unwrap();
                    Ok(MethodResult::Empty)
                })),
        ))
        .no_verify_in_drop();
        let scheduler = ServePool::new(Arc::new(inner), 1);
        let cancel: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
        let base = scheduler.preparing(cancel.clone(), usage(ready.clone(), observer.clone()));
        let worker = base.clone();
        let call = thread::spawn(move || worker.request(css("/base", 0)));
        let waiting = if !already_settled {
            let event = missing.recv().unwrap();
            let state = scheduler.gate.state.lock().unwrap();
            Some((event, state.active, state.waiting, state.waiting_base))
        } else {
            None
        };
        ready.store(true, Ordering::Release);
        if let Some(wake) = observer.lock().unwrap().as_ref().and_then(Weak::upgrade) {
            wake.notify();
        }
        let observed = missing.recv_timeout(Duration::from_secs(10));
        cancel.cancel();
        let result = call.join().unwrap();
        base.finish();
        assert_eq!(observed, Ok("ordinary"));
        result.unwrap();
        assert_eq!(waiting, (!already_settled).then_some(("miss", 0, 0, 0)));
        assert_eq!(*tries.lock().unwrap(), usize::from(!already_settled));
        assert_eq!(*ordinary.lock().unwrap(), 1);
        assert_eq!(scheduler.gate.state.lock().unwrap().active, 0);
    }
}
