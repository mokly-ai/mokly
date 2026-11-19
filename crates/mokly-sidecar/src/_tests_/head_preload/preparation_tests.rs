//! A head describe wakes Serve, each idle head process then restores and maps the generation in turn,
//! and the first render on such a process still describes it.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::pool::{ReturnWake, ReturnWakeMock, SidecarPool};

use super::calls::{bindings, call, finished, render, send};
use super::support::{Gate, Harness};

#[test]
fn a_head_describe_restores_and_maps_each_idle_head_process_one_at_a_time() {
    let harness = Harness::plain(3, &["/head", "/head", "/head"]);
    harness.describe_head("g");
    let steps = harness.maintain();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    assert_eq!(steps, 2);
    assert_eq!(
        events,
        [
            call(0, "bundle g"),
            call(0, "cssModules g"),
            call(0, "describe g"),
            call(1, "restoreGeneration g"),
            call(1, "cssModules g"),
            call(2, "restoreGeneration g"),
            call(2, "cssModules g"),
        ]
    );
}

#[test]
fn a_preloaded_process_gets_no_describe_until_its_first_render() {
    let hold = Arc::new(Gate::default());
    let held = hold.clone();
    let harness = Harness::new(
        2,
        &["/head", "/head"],
        Arc::new(move |event| {
            if *event == call(0, "page export default") {
                held.block();
            }
            Ok(())
        }),
    );
    harness.describe_head("g");
    let steps = harness.maintain();
    let preloaded = harness.events.calls(1);
    harness.pool.request(bindings("g")).unwrap();
    let (first, first_done) = send(&harness.pool, render("g"));
    hold.entered();
    harness.pool.request(render("g")).unwrap();
    hold.open();
    assert_eq!(finished(&first_done), Ok(true));
    first.join().unwrap();
    let rendered = harness.events.calls(1);
    harness.pool.abort().unwrap();
    assert_eq!(steps, 1);
    assert_eq!(preloaded, ["restoreGeneration g", "cssModules g"]);
    assert_eq!(
        rendered,
        [
            "restoreGeneration g",
            "cssModules g",
            "describe g",
            "bindings g",
            "page export default"
        ]
    );
}

#[test]
fn the_head_describe_wakes_the_maintenance_owner() {
    let harness = Harness::plain(2, &["/head", "/head"]);
    let journal = harness.events.clone();
    let wakes = Arc::new(Mutex::new(Vec::new()));
    let recorded = wakes.clone();
    let wake: Arc<dyn ReturnWake> = Arc::new(
        Unimock::new(
            ReturnWakeMock::notify
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    recorded.lock().unwrap().push(journal.read().len());
                })),
        )
        .no_verify_in_drop(),
    );
    harness.pool.observe_head_return(Arc::downgrade(&wake));
    harness.describe_head("g");
    let first = wakes.lock().unwrap().first().copied();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    assert_eq!(events[2], call(0, "describe g"));
    assert_eq!(first, Some(3), "the first wake follows the describe");
}
