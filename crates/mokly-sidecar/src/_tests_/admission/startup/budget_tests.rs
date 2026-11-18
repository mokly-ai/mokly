//! Rollback returns borrowed admission and retains starts that reached a process.

use std::sync::atomic::Ordering;
use std::sync::{Arc, mpsc};
use std::thread;

use crate::pool::SidecarPool;
use crate::pool_admission::PoolCapacity;

use super::process::Mode;
use super::support::{Event, GUARD, Gate, Harness, css, internal_failure, text, unavailable};

#[test]
fn failed_start_restores_the_budget_borrowed_from_another_live_claim() {
    let maintenance = Arc::new(Gate::default());
    let held = maintenance.clone();
    let harness = Harness::new(
        2,
        &[Mode::Ready, Mode::Missing, Mode::Ready, Mode::Ready],
        Arc::new(move |event| {
            if event == Event::Kill(0) {
                held.hold();
            }
        }),
    );
    assert_eq!(text(harness.pool.request(css("/base", "base"))), "0");
    let first_claim = harness.pool.try_claim().unwrap().unwrap();
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let returning = thread::spawn(move || pool.maintain_head_return());
    maintenance.entered();
    let source_claim = harness.pool.try_claim().unwrap().unwrap();
    harness.host.store(0, Ordering::SeqCst);
    unavailable(
        harness
            .pool
            .request_claimed(css("/repo", "failed"), &first_claim),
    );
    let restored_budget: usize = harness.pool.lock().claims.values().sum();
    drop(first_claim);
    let (send, received) = mpsc::channel();
    let pool = harness.pool.clone();
    let borrower = thread::spawn(move || {
        let result = pool.request_claimed(css("/repo", "borrower"), &source_claim);
        send.send(()).unwrap();
        result
    });
    let progressed_while_maintenance_held = received.recv_timeout(GUARD).is_ok();
    maintenance.open();
    assert!(returning.join().unwrap().unwrap());
    let result = text(borrower.join().unwrap());
    harness.pool.abort().unwrap();
    assert_eq!(
        restored_budget, 1,
        "rollback must restore the source claim's held growth"
    );
    assert!(
        progressed_while_maintenance_held,
        "the admitted call must not wait for maintenance"
    );
    assert_eq!(result, "2");
}

#[test]
fn a_worker_returned_before_failed_hello_keeps_its_replacement_reservation() {
    for after_child in [false, true] {
        let busy = Arc::new(Gate::default());
        let held = busy.clone();
        let modes = if after_child {
            vec![Mode::Ready, Mode::StartedInternal, Mode::Ready]
        } else {
            vec![Mode::Ready, Mode::HelloFailure, Mode::Missing, Mode::Ready]
        };
        let harness = Harness::new(
            2,
            &modes,
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
            let second_claim = harness.pool.try_claim().unwrap().unwrap();
            let failed = harness
                .pool
                .request_claimed(css("/repo", "hello-failed"), &second_claim);
            if after_child {
                internal_failure(failed);
            } else {
                unavailable(failed);
            }
        }
        harness.host.store(0, Ordering::SeqCst);
        let retained = harness.pool.capacity();
        let replacement = harness.start("/repo", "replacement", None);
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
        assert_eq!(text(first.join().unwrap()), "0");
        let replacement = text(replacement.join().unwrap());
        harness.pool.abort().unwrap();
        assert_eq!(retained, 2);
        assert_eq!(replacement, if after_child { "2" } else { "3" });
        assert_eq!(
            harness.events.read().contains(&Event::Kill(1)),
            !after_child
        );
    }
}
