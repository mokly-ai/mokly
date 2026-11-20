//! Failed starts recover on demand; an unconfirmed reap keeps its slot leased.

use std::sync::Arc;
use std::thread;

use crate::error::{Error, Result};
use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Gate, Harness, css, waiting};

fn assert_disabled(failure: Result<bool>) {
    assert!(matches!(&failure, Err(Error::HeadReturnDisabled { source })
        if matches!(source.as_ref(), Error::Unavailable { part } if part == "injected")));
}

#[test]
fn a_failed_background_start_or_hello_leaves_safe_on_demand_recovery() {
    for fault in [Event::Spawn(1, "/head".into()), Event::Hello(1)] {
        let modes = match &fault {
            Event::Hello(_) => vec![Mode::Base, Mode::Hello, Mode::Foreground],
            _ => vec![Mode::Base, Mode::Foreground],
        };
        let harness = Harness::fault(1, &modes, fault.clone());
        harness.pool.request(css("/base", "base")).unwrap();
        harness.pool.schedule_head_return();
        let failure = harness.pool.maintain_head_return();
        assert!(
            matches!(failure, Err(Error::Unavailable { part }) if part == "injected"),
            "{fault:?}"
        );
        assert!(harness.pool.lock().controls.is_empty(), "{fault:?}");
        harness.pool.request(css("/head", "head")).unwrap();
        let events = harness.events.read();
        harness.pool.abort().unwrap();
        assert!(matches!(events.last(), Some(Event::Request(_, label)) if label == "head"));
        assert_eq!(
            events
                .iter()
                .filter(|event| matches!(event, Event::Spawn(_, _)))
                .count(),
            3,
            "{fault:?}"
        );
        let first_reap = events
            .iter()
            .position(|event| *event == Event::Reap(0))
            .unwrap();
        let next_spawn = events
            .iter()
            .position(|event| *event == Event::Spawn(1, "/head".into()))
            .unwrap();
        assert!(first_reap < next_spawn);
    }
}

#[test]
fn a_failed_reap_keeps_the_control_and_cancels_further_demand() {
    let gate = Arc::new(Gate::default());
    let reaping = gate.clone();
    let harness = Harness::fault_with_hook(
        1,
        &[Mode::Retired],
        Event::Reap(0),
        Arc::new(move |event| {
            if event == Event::Reap(0) {
                reaping.block();
            }
        }),
    );
    harness.pool.request(css("/base", "base")).unwrap();
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return());
    gate.entered();
    let pool = harness.pool.clone();
    let queued = thread::spawn(move || pool.request(css("/head", "queued")));
    waiting(&harness.pool, 1);
    gate.open();
    let failure = maintenance.join().unwrap();
    assert_disabled(failure);
    assert!(harness.pool.lock().controls.contains_key(&0));
    assert!(harness.pool.lock().stopped);
    assert!(matches!(queued.join().unwrap(), Err(Error::Cancelled)));
    let request = harness.pool.request(css("/head", "head"));
    harness.pool.shutdown().unwrap();
    let events = harness.events.read();
    assert!(matches!(request, Err(Error::Cancelled)));
    assert_eq!(
        events,
        [
            Event::Spawn(0, "/base".into()),
            Event::Hello(0),
            Event::Request(0, "base".into()),
            Event::Kill(0),
            Event::Reap(0),
            Event::Shutdown(0),
            Event::Reap(0)
        ]
    );
}

#[test]
fn a_failed_reap_retires_only_its_slot_and_preserves_usable_capacity() {
    for prestarted in [false, true] {
        let harness = Harness::fault(2, &[Mode::Retired, Mode::IdleShutdown], Event::Reap(0));
        harness.pool.request(css("/base", "base")).unwrap();
        if prestarted {
            harness.pool.request(css("/head", "existing")).unwrap();
        }
        harness.pool.schedule_head_return();
        let failure = harness.pool.maintain_head_return();
        assert_disabled(failure);
        assert!(!harness.pool.lock().stopped, "prestarted: {prestarted}");
        assert!(harness.pool.lock().controls.contains_key(&0));
        assert!(!harness.pool.lock().available.contains(&0));
        harness.pool.request(css("/head", "healthy")).unwrap();
        harness.pool.schedule_head_return();
        assert!(!harness.pool.maintain_head_return().unwrap());
        harness.pool.shutdown().unwrap();
        let events = harness.events.read();
        assert_eq!(
            &events[events.len() - 5..],
            [
                Event::Request(1, "healthy".into()),
                Event::Shutdown(0),
                Event::Shutdown(1),
                Event::Reap(0),
                Event::Reap(1)
            ],
            "prestarted: {prestarted}"
        );
    }
}

#[test]
fn a_retired_postcss_slot_fails_queued_and_new_affine_calls() {
    let gate = Arc::new(Gate::default());
    let reaping = gate.clone();
    let harness = Harness::fault_with_hook(
        2,
        &[Mode::Retired],
        Event::Reap(0),
        Arc::new(move |event| {
            if event == Event::Reap(0) {
                reaping.block();
            }
        }),
    );
    harness.pool.request(css("/base", "base")).unwrap();
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return());
    gate.entered();
    let pool = harness.pool.clone();
    let queued = thread::spawn(move || pool.request(css("/base", "base")));
    waiting(&harness.pool, 1);
    gate.open();
    let failure = maintenance.join().unwrap();
    assert_disabled(failure);
    let queued = queued.join().unwrap();
    let later = harness.pool.request(css("/base", "base"));
    harness.pool.shutdown().unwrap();
    for result in [queued, later] {
        assert!(
            matches!(result, Err(Error::Unavailable { part }) if part == "PostCSS context worker")
        );
    }
}
