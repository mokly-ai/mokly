//! A request that arrives during a preload takes the process after the call in flight.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;
use crate::pool_admission::PoolCapacity;

use super::calls::{call, css, finished, send};
use super::support::{Event, Gate, Harness};

#[test]
fn a_waiting_request_takes_the_preloading_process_after_its_call() {
    let restore = Arc::new(Gate::default());
    let hold = Arc::new(Gate::default());
    let (held_restore, held_request) = (restore.clone(), hold.clone());
    let harness = Harness::new(
        4,
        &["/head", "/head", "/base"],
        Arc::new(move |event| {
            if *event == call(1, "restoreGeneration g") {
                held_restore.block();
            }
            if *event == call(0, "hold") {
                held_request.block();
            }
            Ok(())
        }),
    );
    harness.describe_head("g");
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
    restore.entered();
    let (first, first_done) = send(&harness.pool, css("/head", "first"));
    assert_eq!(
        finished(&first_done),
        Ok(true),
        "an idle head process serves at once"
    );
    first.join().unwrap();
    let (busy, busy_done) = send(&harness.pool, css("/head", "hold"));
    hold.entered();
    let (queued, queued_done) = send(&harness.pool, css("/head", "queued"));
    harness.queued_or_started(1);
    let (base, base_done) = send(&harness.pool, css("/base", "base"));
    assert_eq!(
        finished(&base_done),
        Ok(true),
        "a later base request does not queue behind it"
    );
    base.join().unwrap();
    restore.open();
    assert_eq!(finished(&queued_done), Ok(true));
    queued.join().unwrap();
    hold.open();
    assert_eq!(finished(&busy_done), Ok(true));
    busy.join().unwrap();
    assert!(maintenance.join().unwrap());
    let interrupted = harness.events.calls(1);
    let resumed = harness.maintain();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    assert_eq!(interrupted, ["restoreGeneration g", "queued"]);
    assert_eq!(resumed, 1);
    assert_eq!(
        harness.events.calls(1),
        ["restoreGeneration g", "queued", "cssModules g"]
    );
    assert_eq!(harness.events.calls(2), ["base"]);
    assert!(!events.contains(&Event::Spawn), "{events:?}");
}

#[test]
fn a_second_head_request_keeps_its_choice_while_the_first_waits() {
    let restore = Arc::new(Gate::default());
    let hold = Arc::new(Gate::default());
    let (held_restore, held_request) = (restore.clone(), hold.clone());
    let harness = Harness::new(
        4,
        &["/head", "/head"],
        Arc::new(move |event| {
            if *event == call(1, "restoreGeneration g") {
                held_restore.block();
            }
            if *event == call(0, "hold") {
                held_request.block();
            }
            Ok(())
        }),
    );
    harness.describe_head("g");
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
    restore.entered();
    let (busy, busy_done) = send(&harness.pool, css("/head", "hold"));
    hold.entered();
    let (first, first_done) = send(&harness.pool, css("/head", "first"));
    harness.queued_or_started(1);
    let (second, second_done) = send(&harness.pool, css("/head", "second"));
    let second_outcome = finished(&second_done);
    let started = harness.events.read().contains(&Event::Spawn);
    assert_eq!(
        (second_outcome, started),
        (Ok(false), true),
        "the second request tries its own process start at once"
    );
    second.join().unwrap();
    restore.open();
    assert_eq!(finished(&first_done), Ok(true));
    first.join().unwrap();
    hold.open();
    assert_eq!(finished(&busy_done), Ok(true));
    busy.join().unwrap();
    assert!(maintenance.join().unwrap());
    let calls = harness.events.calls(1);
    harness.pool.abort().unwrap();
    assert_eq!(calls, ["restoreGeneration g", "first"]);
}

#[test]
fn a_call_that_serve_admitted_holds_back_the_preload_until_it_arrives() {
    let restore = Arc::new(Gate::default());
    let held = restore.clone();
    let harness = Harness::new(
        3,
        &["/head", "/head", "/head"],
        Arc::new(move |event| {
            if *event == call(2, "restoreGeneration g") {
                held.block();
            }
            Ok(())
        }),
    );
    harness.describe_head("g");
    let early = harness.pool.try_claim().unwrap().unwrap();
    let before_arrival = harness.pool.maintain_head_return().unwrap();
    harness
        .pool
        .request_claimed(css("/head", "arrived"), &early)
        .unwrap();
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
    restore.entered();
    let late = harness.pool.try_claim().unwrap().unwrap();
    restore.open();
    assert!(maintenance.join().unwrap());
    let interrupted = harness.events.calls(2);
    drop(late);
    drop(early);
    let resumed = harness.maintain();
    harness.pool.abort().unwrap();
    assert!(
        !before_arrival,
        "an admitted call on its way holds back the claim"
    );
    assert_eq!(interrupted, ["restoreGeneration g"]);
    assert_eq!(resumed, 2);
    assert_eq!(
        harness.events.calls(1),
        ["arrived", "restoreGeneration g", "cssModules g"]
    );
    assert_eq!(
        harness.events.calls(2),
        ["restoreGeneration g", "cssModules g"]
    );
}
