//! Unused starts must return to admission without stranding their contexts.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use crate::pool::SidecarPool;
use crate::pool_admission::PoolCapacity;

use super::process::Mode;
use super::support::{Event, GIB, GUARD, Gate, Harness, css, internal_failure, text, unavailable};

#[test]
fn failed_first_start_requires_fresh_admission_for_a_direct_retry() {
    let busy = Arc::new(Gate::default());
    let held = busy.clone();
    let harness = Harness::new(
        2,
        &[Mode::Ready, Mode::NotStartedInternal, Mode::Ready],
        Arc::new(move |event| {
            if event == Event::Request(0, "busy".into()) {
                held.hold();
            }
        }),
    );
    let first_claim = harness.pool.try_claim().unwrap().unwrap();
    let first = harness.start("/repo", "busy", Some(first_claim));
    busy.entered();
    {
        let failed_claim = harness.pool.try_claim().unwrap().unwrap();
        internal_failure(
            harness
                .pool
                .request_claimed(css("/repo", "failed"), &failed_claim),
        );
    }
    harness.host.store(0, Ordering::SeqCst);
    let after_failure = harness.pool.capacity();
    let retry = harness.start("/repo", "direct", None);
    {
        let state = harness.pool.lock();
        let (state, _) = harness
            .pool
            .ready
            .wait_timeout_while(state, GUARD, |state| state.ticket < 3)
            .unwrap();
        assert_eq!(state.ticket, 3);
    }
    busy.open();
    let first_text = text(first.join().unwrap());
    let retry_text = text(retry.join().unwrap());
    harness.pool.abort().unwrap();
    assert_eq!(
        after_failure, 1,
        "a failed first start must leave no reservation"
    );
    assert_eq!(first_text, "0");
    assert_eq!(
        retry_text, "0",
        "a direct retry must use the admitted busy slot"
    );
}

#[test]
fn failed_context_retries_on_a_real_slot_and_freed_capacity_can_grow_again() {
    let busy = Arc::new(Gate::default());
    let again = Arc::new(Gate::default());
    let held = busy.clone();
    let held_again = again.clone();
    let harness = Harness::new(
        2,
        &[Mode::Ready, Mode::Missing, Mode::Ready],
        Arc::new(move |event| {
            if event == Event::Request(0, "busy".into()) {
                held.hold();
            }
            if event == Event::Request(0, "busy-again".into()) {
                held_again.hold();
            }
        }),
    );
    let first = harness.start("/repo", "busy", None);
    busy.entered();
    unavailable(harness.pool.request(css("/repo", "failed")));
    harness.host.store(0, Ordering::SeqCst);
    busy.open();
    assert_eq!(text(first.join().unwrap()), "0");
    let retried = text(harness.pool.request(css("/repo", "failed")));
    let occupied = harness.start("/repo", "busy-again", None);
    again.entered();
    harness.host.store(3 * GIB, Ordering::SeqCst);
    let recovered = text(harness.pool.request(css("/repo", "recovered")));
    harness.host.store(0, Ordering::SeqCst);
    let recovered_capacity = harness.pool.capacity();
    again.open();
    assert_eq!(text(occupied.join().unwrap()), "0");
    harness.pool.abort().unwrap();
    assert_eq!(
        retried, "0",
        "the failed context must not retain an unused slot binding"
    );
    assert_eq!(recovered, "2");
    assert_eq!(recovered_capacity, 2);
    assert_eq!(
        harness.pool.lock().slots.len(),
        2,
        "growth must reuse the free index"
    );
}
