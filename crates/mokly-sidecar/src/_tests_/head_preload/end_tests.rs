//! Busy, base, and missing processes get no preload, and stops or newer work end it.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::calls::{bundle, call, css, describe, finished, maps, send};
use super::support::{Gate, Harness};

type Action = fn(&Harness);

const CANCEL: Action = |harness| harness.pool.cancel_requests().unwrap();
const SHUTDOWN: Action = |harness| harness.pool.shutdown().unwrap();
const ABORT: Action = |harness| harness.pool.abort().unwrap();
const NEWER: Action = |harness| {
    harness.pool.request(bundle("h")).unwrap();
};
const RELEASE: Action = |harness| harness.pool.release_generation("g", 1);

#[test]
fn a_busy_head_process_gets_the_preload_only_after_its_request() {
    let hold = Arc::new(Gate::default());
    let held = hold.clone();
    let harness = Harness::new(
        2,
        &["/head", "/head"],
        Arc::new(move |event| {
            if *event == call(1, "hold") {
                held.block();
            }
            Ok(())
        }),
    );
    harness.pool.request(bundle("g")).unwrap();
    let (busy, busy_done) = send(&harness.pool, css("/head", "hold"));
    hold.entered();
    harness.pool.request(maps("g")).unwrap();
    harness.pool.request(describe("g")).unwrap();
    let while_busy = harness.maintain();
    hold.open();
    assert_eq!(finished(&busy_done), Ok(true));
    busy.join().unwrap();
    let after = harness.maintain();
    harness.pool.abort().unwrap();
    assert_eq!((while_busy, after), (0, 1));
    assert_eq!(
        harness.events.calls(1),
        ["hold", "restoreGeneration g", "cssModules g"]
    );
}

#[test]
fn the_preload_skips_base_processes_and_starts_no_process() {
    let harness = Harness::plain(3, &["/head", "/base"]);
    harness.describe_head("g");
    let steps = harness.maintain();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    assert_eq!(steps, 0);
    assert_eq!(
        events,
        [
            call(0, "bundle g"),
            call(0, "cssModules g"),
            call(0, "describe g")
        ]
    );
}

#[test]
fn a_stop_a_release_or_a_newer_generation_before_a_step_prevents_the_preload() {
    let cases: [(&str, Action, &[&str]); 5] = [
        ("cancel", CANCEL, &[]),
        ("shutdown", SHUTDOWN, &[]),
        ("abort", ABORT, &[]),
        ("newer generation", NEWER, &["bundle h"]),
        ("release", RELEASE, &[]),
    ];
    for (name, action, expected) in cases {
        let harness = Harness::plain(2, &["/head", "/head"]);
        harness.describe_head("g");
        action(&harness);
        let steps = harness.maintain();
        let calls = harness.events.calls(1);
        harness.pool.abort().unwrap();
        assert_eq!(steps, 0, "{name}");
        assert_eq!(calls, expected, "{name}");
    }
}

#[test]
fn a_stop_a_release_or_a_newer_generation_ends_the_preload_after_its_call() {
    let cases: [(&str, Action, &[&str]); 5] = [
        ("cancel", CANCEL, &["restoreGeneration g"]),
        ("shutdown", SHUTDOWN, &["restoreGeneration g"]),
        ("abort", ABORT, &["restoreGeneration g"]),
        ("newer generation", NEWER, &["restoreGeneration g"]),
        ("release", RELEASE, &["restoreGeneration g", "dispose g"]),
    ];
    for (name, action, expected) in cases {
        let restore = Arc::new(Gate::default());
        let held = restore.clone();
        let harness = Harness::new(
            2,
            &["/head", "/head"],
            Arc::new(move |event| {
                if *event == call(1, "restoreGeneration g") {
                    held.block();
                }
                Ok(())
            }),
        );
        harness.describe_head("g");
        let pool = harness.pool.clone();
        let maintenance = thread::spawn(move || pool.maintain_head_return());
        restore.entered();
        action(&harness);
        restore.open();
        let stepped = maintenance.join().unwrap();
        harness.pool.synchronize_releases();
        let calls = harness.events.calls(1);
        harness.pool.abort().unwrap();
        assert!(matches!(stepped, Ok(true)), "{name}: {stepped:?}");
        assert_eq!(calls, expected, "{name}");
    }
}
