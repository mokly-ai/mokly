//! Terminal claims cancel queued work; temporary denials retain normal waiting.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_server::changes::ChangeToken;
use mokly_server::changes_signal::ChangeSignal;
use mokly_server::foreground::Foreground;
use mokly_sidecar::error::Error;
use mokly_sidecar::pool::{PoolMock, ReturnWake};
use mokly_sidecar::pool_admission::CapacityMock;
use mokly_sidecar::pool_claim::CallClaim;
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_claim_failure_support::{HANG_GUARD, counters, queued, request};

#[test]
fn a_failed_return_wakes_denied_claims_and_cancels_every_waiter() {
    let stopped = Arc::new(AtomicBool::new(false));
    let (denied, denials) = mpsc::channel();
    let source = Unimock::new((
        CapacityMock::capacity
            .each_call(matching!())
            .returns(1_usize),
        CapacityMock::try_claim
            .each_call(matching!())
            .answers_arc(Arc::new({
                let stopped = stopped.clone();
                move |_| {
                    if stopped.load(Ordering::SeqCst) {
                        return Err(Error::Cancelled);
                    }
                    denied.send(()).unwrap();
                    Ok(None)
                }
            })),
    ))
    .no_verify_in_drop();
    let (returning, returns) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let inner = Unimock::new(PoolMock::maintain_head_return.stub(|each| {
        each.call(matching!())
            .answers_arc(Arc::new(move |_| {
                returning.send(()).unwrap();
                released.lock().unwrap().recv().unwrap();
                stopped.store(true, Ordering::SeqCst);
                Err(Error::HeadReturnDisabled {
                    source: Box::new(Error::Unavailable {
                        part: "injected reap".into(),
                    }),
                })
            }))
            .once()
            .then()
            .answers(&|_| Ok(false));
    }))
    .no_verify_in_drop();
    let scheduler = ServePool::new(Arc::new(inner), Arc::new(source));
    let _foreground = scheduler.enter();
    let head = request(scheduler.pool(None), "/head", 0);
    denials.recv_timeout(HANG_GUARD).unwrap();
    let wake = scheduler
        .gate
        .return_wake
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .clone();
    wake.notify();
    returns.recv_timeout(HANG_GUARD).unwrap();
    let base = request(
        scheduler.pool(Some(Arc::new(ChangeToken::default()))),
        "/base",
        1,
    );
    let before_stop = queued(&scheduler, 0, 2);
    denials.recv_timeout(HANG_GUARD).unwrap();
    let parked_before_stop = counters(&scheduler);
    release.send(()).unwrap();
    let head_result = head.receive();
    let base_result = base.receive();
    let later = request(scheduler.pool(None), "/head", 2);
    let later_result = later.receive();
    scheduler.gate.close();
    head.join();
    base.join();
    later.join();
    assert_eq!(before_stop, (0, 2, 1));
    assert_eq!(parked_before_stop, (0, 2, 1, 2));
    assert!(
        matches!(head_result, Ok(Err(Error::Cancelled))),
        "{head_result:?}"
    );
    assert!(
        matches!(base_result, Ok(Err(Error::Cancelled))),
        "{base_result:?}"
    );
    assert!(
        matches!(later_result, Ok(Err(Error::Cancelled))),
        "{later_result:?}"
    );
    assert_eq!(counters(&scheduler), (0, 0, 0, 1));
}

#[test]
fn a_temporarily_denied_claim_waits_then_runs_after_admission_wakes() {
    let allowed = Arc::new(AtomicBool::new(false));
    let (denied, denials) = mpsc::channel();
    let source = Unimock::new((
        CapacityMock::capacity
            .each_call(matching!())
            .returns(1_usize),
        CapacityMock::try_claim
            .each_call(matching!())
            .answers_arc(Arc::new({
                let allowed = allowed.clone();
                move |_| {
                    if allowed.load(Ordering::SeqCst) {
                        return Ok(Some(CallClaim::fixed()));
                    }
                    denied.send(()).unwrap();
                    Ok(None)
                }
            })),
    ))
    .no_verify_in_drop();
    let inner = Unimock::new(
        PoolMock::request
            .each_call(matching!(_))
            .answers(&|_, _| Ok(MethodResult::Empty)),
    )
    .no_verify_in_drop();
    let scheduler = ServePool::new(Arc::new(inner), Arc::new(source));
    let head = request(scheduler.pool(None), "/head", 0);
    denials.recv_timeout(HANG_GUARD).unwrap();
    let denied_state = counters(&scheduler);
    allowed.store(true, Ordering::SeqCst);
    scheduler.gate.notify();
    let result = head.receive();
    scheduler.gate.close();
    head.join();
    assert_eq!(denied_state, (0, 1, 0, 1));
    assert!(matches!(result, Ok(Ok(MethodResult::Empty))), "{result:?}");
    assert_eq!(counters(&scheduler), (0, 0, 0, 0));
}
