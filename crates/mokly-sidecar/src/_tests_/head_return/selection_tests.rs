//! Base demand leaves the newest useful head process when capacity is idle.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Gate, Harness, bundle, css, install, render};

#[test]
fn base_work_preserves_the_process_of_the_newest_head_bundle() {
    let gate = Arc::new(Gate::default());
    let blocked = gate.clone();
    let base_gate = Arc::new(Gate::default());
    let base_blocked = base_gate.clone();
    let harness = Harness::new(
        2,
        &[Mode::Foreground; 4],
        Arc::new(move |event| {
            if event == Event::Request(0, "hold".into()) {
                blocked.block();
            }
            if event == Event::Request(2, "base-hold".into()) {
                base_blocked.block();
            }
        }),
    );
    let pool = &harness.pool;
    pool.request(bundle("/head", "older")).unwrap();
    let held = pool.clone();
    let busy = thread::spawn(move || held.request(css("/head", "hold")).unwrap());
    gate.entered();
    pool.request(bundle("/head", "newest")).unwrap();
    gate.open();
    busy.join().unwrap();
    pool.request(css("/base", "base")).unwrap();
    let killed = harness
        .events
        .read()
        .into_iter()
        .filter(|event| matches!(event, Event::Kill(_)))
        .collect::<Vec<_>>();
    let held = pool.clone();
    let busy = thread::spawn(move || held.request(css("/base", "base-hold")).unwrap());
    base_gate.entered();
    pool.request(css("/base", "base-parallel")).unwrap();
    base_gate.open();
    busy.join().unwrap();
    let saturated = harness
        .events
        .read()
        .into_iter()
        .filter(|event| matches!(event, Event::Kill(_)))
        .collect::<Vec<_>>();
    pool.abort().unwrap();
    assert_eq!(killed, [Event::Kill(0)]);
    assert_eq!(saturated, [Event::Kill(0), Event::Kill(1)]);
}

#[test]
fn a_successful_render_moves_protection_to_its_process() {
    let gate = Arc::new(Gate::default());
    let blocked = gate.clone();
    let newest_gate = Arc::new(Gate::default());
    let newest_blocked = newest_gate.clone();
    let harness = Harness::new(
        2,
        &[Mode::Foreground; 3],
        Arc::new(move |event| {
            if event == Event::Request(0, "hold".into()) {
                blocked.block();
            }
            if event == Event::Request(1, "hold-newest".into()) {
                newest_blocked.block();
            }
        }),
    );
    let pool = &harness.pool;
    pool.request(bundle("/head", "older")).unwrap();
    let held = pool.clone();
    let busy = thread::spawn(move || held.request(css("/head", "hold")).unwrap());
    gate.entered();
    pool.request(bundle("/head", "newest")).unwrap();
    install(pool.as_ref(), "newest");
    gate.open();
    busy.join().unwrap();
    let held = pool.clone();
    let busy = thread::spawn(move || held.request(css("/head", "hold-newest")).unwrap());
    newest_gate.entered();
    pool.request(render("newest")).unwrap();
    newest_gate.open();
    busy.join().unwrap();
    pool.request(css("/base", "base")).unwrap();
    let killed = harness
        .events
        .read()
        .into_iter()
        .filter(|event| matches!(event, Event::Kill(_)))
        .collect::<Vec<_>>();
    pool.abort().unwrap();
    assert_eq!(killed, [Event::Kill(1)]);
}
