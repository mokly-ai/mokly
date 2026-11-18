//! Prospective growth accounts for memory and retains admitted reservations.

use std::sync::atomic::Ordering;

use crate::pool::SidecarPool;
use crate::pool_admission::PoolCapacity;
use crate::wire::MethodResult;

use super::support::{GIB, Harness};

#[test]
fn low_or_unknown_memory_keeps_first_progress_and_reuses_its_reservation() {
    for available in [None, Some(0), Some(2 * GIB)] {
        let mut harness = Harness::new(4, available, true);
        assert_eq!(harness.pool.capacity(), 1);
        let first = harness.start(0);
        assert_eq!(harness.events.recv().unwrap(), 0);
        let second = harness.start(1);
        harness.queued(2);
        assert_eq!(harness.pool.lock().slots.len(), 1);
        harness.release(0);
        assert_eq!(harness.events.recv().unwrap(), 1);
        harness.release(1);
        for job in [first, second] {
            assert!(matches!(job.join().unwrap(), MethodResult::Css(_)));
        }
        assert_eq!(harness.starts.load(Ordering::SeqCst), 1);
    }
}

#[test]
fn recovery_grows_on_a_normal_release_wake_without_waiting_for_the_busy_worker() {
    let mut harness = Harness::new(4, Some(2 * GIB), true);
    let first = harness.start(0);
    assert_eq!(harness.events.recv().unwrap(), 0);
    let second = harness.start(1);
    harness.queued(2);
    assert_eq!(harness.pool.lock().slots.len(), 1);
    harness.host.store(4 * GIB, Ordering::SeqCst);
    harness.pool.release_context("unused");
    assert_eq!(harness.events.recv().unwrap(), 1);
    assert_eq!(harness.pool.lock().slots.len(), 2);
    harness.release(0);
    harness.release(1);
    first.join().unwrap();
    second.join().unwrap();
}

#[test]
fn exact_counts_bypass_memory_and_healthy_defaults_retain_four_reservations() {
    let mut sample_counts = Vec::new();
    for guarded in [false, true] {
        let mut harness = Harness::new(4, Some(5 * GIB), guarded);
        let jobs: Vec<_> = (0..4)
            .map(|index| {
                let claim = harness.pool.try_claim().unwrap().unwrap();
                harness.start_claimed(index, Some(claim))
            })
            .collect();
        let mut entered: Vec<_> = (0..4).map(|_| harness.events.recv().unwrap()).collect();
        entered.sort();
        assert_eq!(entered, [0, 1, 2, 3]);
        assert_eq!(harness.pool.lock().slots.len(), 4);
        let before = harness.samples.load(Ordering::SeqCst);
        harness.host.store(0, Ordering::SeqCst);
        assert_eq!(harness.pool.capacity(), 4);
        assert_eq!(harness.samples.load(Ordering::SeqCst), before);
        for index in 0..4 {
            harness.release(index);
        }
        for job in jobs {
            job.join().unwrap();
        }
        sample_counts.push(harness.samples.load(Ordering::SeqCst));
    }
    assert_eq!(sample_counts[0], 0);
}

#[test]
fn concurrent_reservations_do_not_reuse_the_same_remaining_memory() {
    let mut harness = Harness::new(4, Some(3 * GIB), true);
    harness.pause_start();
    let jobs: Vec<_> = (0..4).map(|index| harness.start(index)).collect();
    harness.queued(4);
    assert_eq!(harness.pool.lock().slots.len(), 2);
    assert_eq!(harness.pool.capacity(), 2);
    assert!(harness.pool.lock().controls.is_empty());
    harness.resume_start();
    for index in 0..4 {
        harness.release(index);
    }
    for job in jobs {
        job.join().unwrap();
    }
    assert_eq!(harness.starts.load(Ordering::SeqCst), 2);
}

#[test]
fn current_busy_resident_memory_is_credited_and_a_lower_sample_removes_credit() {
    let mut harness = Harness::new(4, Some(3 * GIB), true);
    let first = harness.start(0);
    assert_eq!(harness.events.recv().unwrap(), 0);
    harness.rss.store(GIB / 2, Ordering::SeqCst);
    harness.host.store(5 * GIB / 2, Ordering::SeqCst);
    assert_eq!(harness.pool.capacity(), 2);
    harness.rss.store(0, Ordering::SeqCst);
    assert_eq!(harness.pool.capacity(), 1);
    harness.rss.store(u64::MAX, Ordering::SeqCst);
    assert_eq!(harness.pool.capacity(), 1);
    harness.release(0);
    first.join().unwrap();
}

#[test]
fn a_retired_index_cannot_block_the_first_usable_reservation_or_be_reused() {
    let mut harness = Harness::new(4, None, true);
    let first = harness.start(0);
    assert_eq!(harness.events.recv().unwrap(), 0);
    harness.release(0);
    first.join().unwrap();
    {
        let mut state = harness.pool.lock();
        state.slots[0] = None;
        state.available.clear();
        state.retired.insert(0);
    }
    assert_eq!(harness.pool.capacity(), 1);
    let next = harness.start(1);
    harness.queued(2);
    assert_eq!(harness.pool.lock().slots.len(), 2);
    assert_eq!(harness.events.recv().unwrap(), 1);
    harness.release(1);
    next.join().unwrap();
    assert_eq!(
        harness
            .pool
            .lock()
            .retired
            .iter()
            .copied()
            .collect::<Vec<_>>(),
        [0]
    );
    assert_eq!(harness.starts.load(Ordering::SeqCst), 2);
}

#[test]
fn empty_reserved_slots_restart_under_unknown_memory_without_readmitting_growth() {
    let mut harness = Harness::new(4, None, true);
    {
        let mut state = harness.pool.lock();
        state.slots.resize_with(3, || None);
        state.available.extend(0..3);
    }
    assert_eq!(harness.pool.capacity(), 3);
    let mut jobs: Vec<_> = (0..3).map(|index| harness.start(index)).collect();
    let mut entered: Vec<_> = (0..3).map(|_| harness.events.recv().unwrap()).collect();
    entered.sort();
    assert_eq!(entered, [0, 1, 2]);
    jobs.push(harness.start(3));
    harness.queued(4);
    assert_eq!(harness.pool.lock().slots.len(), 3);
    harness.release(0);
    assert_eq!(harness.events.recv().unwrap(), 3);
    for index in 1..4 {
        harness.release(index);
    }
    for job in jobs {
        job.join().unwrap();
    }
    assert_eq!(harness.starts.load(Ordering::SeqCst), 3);
}
