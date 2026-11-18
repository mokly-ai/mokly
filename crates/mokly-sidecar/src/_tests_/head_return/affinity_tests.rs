//! A waiter bound to another live PostCSS context cannot claim this transition.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Gate, Harness, css, waiting};

#[test]
fn a_base_waiter_for_another_postcss_slot_does_not_take_the_returning_slot() {
    let gates = Arc::new([Gate::default(), Gate::default(), Gate::default()]);
    let blocked = gates.clone();
    let harness = Harness::new(
        2,
        &[Mode::Base, Mode::Foreground, Mode::Ready],
        Arc::new(move |event| {
            if event == Event::Request(0, "hold-0".into()) {
                blocked[0].block();
            }
            if event == Event::Request(1, "hold-1".into()) {
                blocked[1].block();
            }
            if event == Event::Reap(0) {
                blocked[2].block();
            }
        }),
    );
    let pool = harness.pool.clone();
    let first = thread::spawn(move || pool.request(css("/base", "hold-0")).unwrap());
    gates[0].entered();
    let pool = harness.pool.clone();
    let second = thread::spawn(move || pool.request(css("/base", "hold-1")).unwrap());
    gates[1].entered();
    gates[0].open();
    first.join().unwrap();
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
    gates[2].entered();
    let pool = harness.pool.clone();
    let queued = thread::spawn(move || pool.request(css("/base", "hold-1")).unwrap());
    waiting(&harness.pool, 1);
    gates[2].open();
    assert!(maintenance.join().unwrap());
    let prepared = harness.events.read();
    gates[1].open();
    second.join().unwrap();
    queued.join().unwrap();
    harness.pool.abort().unwrap();
    assert!(prepared.contains(&Event::Spawn(2, "/head".into())));
    assert_eq!(
        prepared
            .iter()
            .filter(|event| matches!(event, Event::Kill(_)))
            .cloned()
            .collect::<Vec<_>>(),
        [Event::Kill(0)]
    );
}

#[test]
fn a_queued_base_request_defers_the_next_return_transition() {
    let gates = Arc::new([Gate::default(), Gate::default()]);
    let blocked = gates.clone();
    let harness = Harness::new(
        2,
        &[Mode::Base, Mode::Foreground, Mode::Ready],
        Arc::new(move |event| {
            if event == Event::Request(0, "hold-0".into()) {
                blocked[0].block();
            }
            if event == Event::Request(1, "hold-1".into()) {
                blocked[1].block();
            }
        }),
    );
    let pool = harness.pool.clone();
    let first = thread::spawn(move || pool.request(css("/base", "hold-0")).unwrap());
    gates[0].entered();
    let pool = harness.pool.clone();
    let second = thread::spawn(move || pool.request(css("/base", "hold-1")).unwrap());
    gates[1].entered();
    gates[0].open();
    first.join().unwrap();
    let pool = harness.pool.clone();
    let queued = thread::spawn(move || pool.request(css("/base", "hold-1")).unwrap());
    waiting(&harness.pool, 1);
    harness.pool.schedule_head_return();
    let premature = harness.pool.maintain_head_return().unwrap();
    gates[1].open();
    second.join().unwrap();
    queued.join().unwrap();
    while harness.pool.maintain_head_return().unwrap() {}
    harness.pool.abort().unwrap();
    assert!(!premature);
}
