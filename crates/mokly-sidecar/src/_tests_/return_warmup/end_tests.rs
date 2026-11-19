//! Stops, base work, and newer or other head generations end the warm-up.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::calls::{call, css, prepared, render, replayed, views};
use super::support::{Gate, Harness};

type Action = fn(&Harness);

const CANCEL: Action = |harness| harness.pool.cancel_requests().unwrap();
const SHUTDOWN: Action = |harness| harness.pool.shutdown().unwrap();
const ABORT: Action = |harness| harness.pool.abort().unwrap();
const NEWER: Action = |harness| harness.head("h", &[]);
const BASE: Action = |harness| {
    harness.pool.request(css("/base", "later")).unwrap();
};

#[test]
fn no_warm_up_runs_after_a_stop_a_newer_head_generation_or_a_move_to_the_base_root() {
    let cases: [(&str, Action); 5] = [
        ("cancel", CANCEL),
        ("shutdown", SHUTDOWN),
        ("abort", ABORT),
        ("newer generation", NEWER),
        ("base request", BASE),
    ];
    for (name, action) in cases {
        let harness = Harness::plain(1);
        harness.head("g", &views("view", 2));
        harness.base();
        harness.returned();
        action(&harness);
        let before = harness.events.read();
        let worked = harness.pool.maintain_head_return();
        let after = harness.events.read();
        let _ = harness.pool.abort();
        assert!(matches!(worked, Ok(false)), "{name}: {worked:?}");
        assert_eq!(after, before, "{name}");
    }
}

#[test]
fn a_stop_or_a_newer_head_generation_ends_the_warm_up_after_the_call_in_flight() {
    let cases: [(&str, Action); 4] = [
        ("cancel", CANCEL),
        ("shutdown", SHUTDOWN),
        ("abort", ABORT),
        ("newer generation", NEWER),
    ];
    for (name, action) in cases {
        let restore = Arc::new(Gate::default());
        let held = restore.clone();
        let harness = Harness::new(
            2,
            Arc::new(move |event| {
                if *event == call(2, "restoreGeneration g") {
                    held.block();
                }
                Ok(())
            }),
        );
        harness.head("g", &views("view", 2));
        harness.base();
        harness.returned();
        let pool = harness.pool.clone();
        let warming = thread::spawn(move || pool.maintain_head_return());
        restore.entered();
        action(&harness);
        restore.open();
        let stepped = warming.join().unwrap();
        let worked = harness.pool.maintain_head_return();
        let warmed = harness.events.calls(2);
        let _ = harness.pool.abort();
        assert!(matches!(stepped, Ok(true)), "{name}: {stepped:?}");
        assert!(matches!(worked, Ok(false)), "{name}: {worked:?}");
        assert_eq!(warmed, ["restoreGeneration g"], "{name}");
    }
}

#[test]
fn the_warm_up_replays_only_renders_of_the_newest_head_generation() {
    let harness = Harness::plain(1);
    let newest = views("new", 2);
    harness.head("g", &views("old", 3));
    harness.head("h", &newest);
    harness.base();
    harness.returned();
    let steps = harness.maintain();
    let warmed = harness.events.calls(2);
    harness.pool.abort().unwrap();
    let mut expected = prepared("h");
    expected.extend(replayed("h", &newest));
    assert_eq!(steps, 1);
    assert_eq!(warmed, expected);
}

#[test]
fn a_process_that_holds_another_head_generation_gets_no_warm_up() {
    let harness = Harness::plain(1);
    harness.head("g", &[]);
    harness.head("h", &views("new", 2));
    harness.base();
    harness.returned();
    harness.pool.request(render("g", "old")).unwrap();
    let served = harness.events.calls(2);
    harness.maintain();
    let after = harness.events.calls(2);
    let left = harness.pool.maintain_head_return().unwrap();
    harness.pool.abort().unwrap();
    let mut expected = prepared("g");
    expected.extend(replayed("g", &["old".to_owned()]));
    assert_eq!(served, expected);
    assert_eq!(after, served, "the warm-up never evaluates h beside g");
    assert!(!left);
}
