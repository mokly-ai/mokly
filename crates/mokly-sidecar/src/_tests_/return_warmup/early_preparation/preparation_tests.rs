//! Early restore precedes maps and evaluation, without renders or duplicate loaded state.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::super::calls::{bindings, bundle, call, maps, render};
use super::super::support::Gate;
use super::support::{describe, edit, finish, paired, start, step};

#[test]
fn restore_runs_before_maps_and_describe_waits_for_current_maps() {
    let held = Arc::new(Gate::default());
    let hold = held.clone();
    let harness = paired(Arc::new(move |event| {
        if *event == call(0, &render("old", "holder").to_string()) {
            hold.block();
        }
        Ok(())
    }));
    start(&harness, "new");
    let before = harness.events.calls(1).len();
    assert!(step(&harness), "dispose the older loaded head generation");
    assert!(
        step(&harness),
        "restore before the core supplies class maps"
    );
    assert!(!step(&harness), "evaluation waits for current class maps");
    assert_eq!(
        &harness.events.calls(1)[before..],
        ["dispose old", "restoreGeneration new"]
    );
    harness.pool.request(maps("new")).unwrap();
    assert!(
        step(&harness),
        "current class maps can install before visible evaluation"
    );
    assert!(
        !step(&harness),
        "quiet description waits for visible evaluation"
    );
    describe(&harness, "new");
    finish(&harness);
    assert_eq!(
        &harness.events.calls(1)[before..],
        [
            "dispose old",
            "restoreGeneration new",
            "cssModules new",
            "describe new"
        ]
    );
    assert_eq!(
        &harness.events.quiet(1),
        &[
            "dispose old",
            "restoreGeneration new",
            "cssModules new",
            "describe new"
        ]
    );
    harness.pool.request(bindings("new")).unwrap();
    harness.pool.head_published();
    assert!(!step(&harness));
    let pool = harness.pool.clone();
    let holder = thread::spawn(move || pool.request(render("old", "holder")).unwrap());
    held.entered();
    harness.pool.request(render("old", "recoverable")).unwrap();
    held.open();
    holder.join().unwrap();
    harness.pool.abort().unwrap();
    assert_eq!(
        harness.events.spawns(),
        2,
        "live recipes recover without another process"
    );
    assert!(
        harness
            .events
            .calls(1)
            .contains(&"restoreGeneration old".to_owned())
    );
}

#[test]
fn full_capture_and_edits_before_first_changes_start_no_early_work() {
    let harness = paired(Arc::new(|_| Ok(())));
    harness.pool.begin_head_attempt("current");
    harness.pool.request(edit("before-changes")).unwrap();
    let before = harness.events.read();
    assert!(!step(&harness));
    assert_eq!(harness.events.read(), before);
    harness.pool.schedule_head_return();
    harness.pool.request(bundle("full")).unwrap();
    let before = harness.events.read();
    assert!(!step(&harness));
    assert_eq!(harness.events.read(), before);
    harness.pool.request(edit("after-changes")).unwrap();
    assert!(
        step(&harness),
        "a later Serve edit can prepare after Changes"
    );
    harness.pool.abort().unwrap();
}

#[test]
fn a_repeated_content_id_needs_maps_from_its_new_epoch() {
    let harness = paired(Arc::new(|_| Ok(())));
    start(&harness, "old");
    assert!(step(&harness), "dispose the previous lifetime");
    assert!(step(&harness), "restore the new epoch");
    assert!(
        !step(&harness),
        "retained maps of the previous epoch are insufficient"
    );
    assert!(!harness.events.quiet(1).contains(&"describe old".to_owned()));
    harness.pool.request(maps("old")).unwrap();
    describe(&harness, "old");
    finish(&harness);
    assert_eq!(
        harness.events.quiet(1),
        [
            "dispose old",
            "restoreGeneration old",
            "cssModules old",
            "describe old"
        ]
    );
    harness.pool.abort().unwrap();
}
