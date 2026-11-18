//! Eligible demand takes a safely reaped slot or a completed head hello.

use std::sync::{Arc, Mutex};
use std::thread;

use crate::pool::SidecarPool;
use crate::wire::MethodResult;

use super::process::Mode;
use super::support::{Event, Gate, Harness, css, waiting};

#[test]
fn a_waiting_request_starts_the_process_after_the_old_reap() {
    let gate = Arc::new(Gate::default());
    let reaping = gate.clone();
    let spawner = Arc::new(Mutex::new(None));
    let owner = spawner.clone();
    let harness = Harness::new(
        1,
        &[Mode::Base, Mode::Foreground],
        Arc::new(move |event| {
            if event == Event::Reap(0) {
                reaping.block();
            }
            if event == Event::Spawn(1, "/head".into()) {
                *owner.lock().unwrap() = Some(thread::current().id());
            }
        }),
    );
    harness.pool.request(css("/base", "base")).unwrap();
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
    gate.entered();
    let pool = harness.pool.clone();
    let request = thread::spawn(move || pool.request(css("/head", "head")).unwrap());
    let request_thread = request.thread().id();
    waiting(&harness.pool, 1);
    gate.open();
    assert!(maintenance.join().unwrap());
    request.join().unwrap();
    harness.pool.abort().unwrap();
    assert_eq!(*spawner.lock().unwrap(), Some(request_thread));
}

#[test]
fn head_demand_during_hello_uses_the_replacement_without_another_spawn() {
    let gate = Arc::new(Gate::default());
    let hello = gate.clone();
    let harness = Harness::new(
        1,
        &[Mode::Base, Mode::Foreground],
        Arc::new(move |event| {
            if event == Event::Hello(1) {
                hello.block();
            }
        }),
    );
    harness.pool.request(css("/base", "base")).unwrap();
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
    gate.entered();
    let pool = harness.pool.clone();
    let request = thread::spawn(move || pool.request(css("/head", "head")));
    waiting(&harness.pool, 1);
    gate.open();
    assert!(maintenance.join().unwrap());
    let result = request.join().unwrap();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    assert!(matches!(result, Ok(MethodResult::Empty)));
    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, Event::Spawn(_, _)))
            .count(),
        2
    );
    assert_eq!(events.last(), Some(&Event::Request(1, "head".into())));
}

#[test]
fn base_demand_during_hello_reaps_the_replacement_before_handover() {
    let gate = Arc::new(Gate::default());
    let hello = gate.clone();
    let harness = Harness::new(
        1,
        &[Mode::Base, Mode::Hello, Mode::Foreground],
        Arc::new(move |event| {
            if event == Event::Hello(1) {
                hello.block();
            }
        }),
    );
    harness.pool.request(css("/base", "base")).unwrap();
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
    gate.entered();
    let pool = harness.pool.clone();
    let request = thread::spawn(move || pool.request(css("/base", "later")).unwrap());
    waiting(&harness.pool, 1);
    gate.open();
    assert!(maintenance.join().unwrap());
    request.join().unwrap();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    assert_eq!(
        &events[7..],
        [
            Event::Kill(1),
            Event::Reap(1),
            Event::Spawn(2, "/base".into()),
            Event::Hello(2),
            Event::Request(2, "later".into())
        ]
    );
}
