//! Temporary claims retain admitted growth and release capacity no worker used.

use std::sync::atomic::Ordering;

use crate::pool_admission::PoolCapacity;

use super::support::{GIB, Harness};

#[test]
fn a_call_claim_guarantees_growth_after_the_live_memory_reading_falls() {
    let mut harness = Harness::new(3, Some(3 * GIB), true);
    let first_claim = harness.pool.try_claim().unwrap().unwrap();
    let first = harness.start_claimed(0, Some(first_claim));
    assert_eq!(harness.events.recv().unwrap(), 0);
    let second_claim = harness.pool.try_claim().unwrap().unwrap();
    harness.host.store(0, Ordering::SeqCst);
    let held_capacity = harness.pool.capacity();
    let second = harness.start_claimed(1, Some(second_claim));
    harness.queued(2);
    let admitted_slots = harness.pool.lock().slots.len();
    harness.release(0);
    harness.release(1);
    first.join().unwrap();
    second.join().unwrap();
    assert_eq!(held_capacity, 2);
    assert_eq!(admitted_slots, 2);
    assert_eq!(harness.starts.load(Ordering::SeqCst), 2);
    assert_eq!(harness.pool.capacity(), 2);
}

#[test]
fn unused_claims_share_the_budget_and_end_without_permanent_reservations() {
    let mut harness = Harness::new(4, Some(3 * GIB), true);
    let (denied, held_capacity) = {
        let _first = harness.pool.try_claim().unwrap().unwrap();
        let _second = harness.pool.try_claim().unwrap().unwrap();
        let denied = harness.pool.try_claim().unwrap().is_none();
        harness.host.store(u64::MAX, Ordering::SeqCst);
        (denied, harness.pool.capacity())
    };
    assert!(denied);
    assert_eq!(held_capacity, 2);
    assert_eq!(harness.pool.capacity(), 1);
    assert_eq!(harness.pool.lock().slots.len(), 0);
    let first = harness.start(0);
    assert_eq!(harness.events.recv().unwrap(), 0);
    let second = harness.start(1);
    harness.queued(2);
    assert_eq!(harness.pool.lock().slots.len(), 1);
    harness.release(0);
    harness.release(1);
    first.join().unwrap();
    second.join().unwrap();
    assert_eq!(harness.starts.load(Ordering::SeqCst), 1);
}

#[test]
fn reusing_an_idle_worker_releases_a_claim_without_retaining_unused_growth() {
    let mut harness = Harness::new(3, Some(3 * GIB), true);
    let first = harness.start(0);
    assert_eq!(harness.events.recv().unwrap(), 0);
    harness.release(0);
    first.join().unwrap();
    let (held_capacity, slots_after_reuse) = {
        let _occupied = harness.pool.try_claim().unwrap().unwrap();
        let extra = harness.pool.try_claim().unwrap().unwrap();
        harness.host.store(u64::MAX, Ordering::SeqCst);
        let held_capacity = harness.pool.capacity();
        let reused = harness.start_claimed(1, Some(extra));
        assert_eq!(harness.events.recv().unwrap(), 1);
        let slots = harness.pool.lock().slots.len();
        harness.release(1);
        reused.join().unwrap();
        assert_eq!(harness.pool.capacity(), 1);
        (held_capacity, slots)
    };
    assert_eq!(held_capacity, 2);
    assert_eq!(slots_after_reuse, 1);
    assert_eq!(harness.starts.load(Ordering::SeqCst), 1);
    assert_eq!(harness.pool.capacity(), 1);
}
