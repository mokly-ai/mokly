//! Real pool retirement reaches queued Serve calls without disabling usable slots.

use std::sync::atomic::Ordering;

use mokly_sidecar::error::Error;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::pool_admission::PoolCapacity;
use mokly_sidecar::wire::MethodResult;

use crate::serve_pool::{BaseCompletion, PoolScheduling};

use super::serve_claim_failure_support::{HANG_GUARD, Retirement, counters, queued, request};
use super::serve_pool_support::css;

#[test]
fn retiring_the_last_slot_cancels_queued_and_later_serve_calls() {
    let harness = Retirement::new(1);
    harness.scheduler.base_finished();
    harness.reaping.recv_timeout(HANG_GUARD).unwrap();
    let admitted = request(harness.scheduler.pool(None), "/head", 1);
    let admission_state = queued(&harness.scheduler, 1, 0);
    let waiting = request(harness.scheduler.pool(None), "/head", 2);
    let waiting_state = queued(&harness.scheduler, 1, 1);
    harness.release.send(()).unwrap();
    let admitted_result = admitted.receive();
    let waiting_result = waiting.receive();
    let later = request(harness.scheduler.pool(None), "/head", 3);
    let later_result = later.receive();
    let terminal_claim = harness.pool.try_claim();
    harness.scheduler.gate.close();
    admitted.join();
    waiting.join();
    later.join();
    harness.pool.abort().unwrap();
    assert_eq!(admission_state, (1, 0, 0));
    assert_eq!(waiting_state, (1, 1, 0));
    assert!(
        matches!(admitted_result, Ok(Err(Error::Cancelled))),
        "{admitted_result:?}"
    );
    assert!(
        matches!(waiting_result, Ok(Err(Error::Cancelled))),
        "{waiting_result:?}"
    );
    assert!(
        matches!(later_result, Ok(Err(Error::Cancelled))),
        "{later_result:?}"
    );
    assert!(matches!(terminal_claim, Err(Error::Cancelled)));
    assert_eq!(counters(&harness.scheduler), (0, 0, 0, 0));
    assert_eq!(harness.starts.load(Ordering::SeqCst), 1);
}

#[test]
fn retiring_one_slot_keeps_serve_admission_open_for_a_usable_slot() {
    let harness = Retirement::new(2);
    harness.pool.request(css("/head", 1)).unwrap();
    harness.scheduler.base_finished();
    harness.reaping.recv_timeout(HANG_GUARD).unwrap();
    harness.release.send(()).unwrap();
    harness.synchronize();
    let healthy = request(harness.scheduler.pool(None), "/head", 2);
    let result = healthy.receive();
    harness.scheduler.gate.close();
    healthy.join();
    harness.pool.abort().unwrap();
    assert!(
        matches!(result, Ok(Ok(MethodResult::Css(ref css))) if css.text == "1"),
        "{result:?}"
    );
    assert_eq!(counters(&harness.scheduler), (0, 0, 0, 0));
    assert_eq!(harness.starts.load(Ordering::SeqCst), 2);
}
