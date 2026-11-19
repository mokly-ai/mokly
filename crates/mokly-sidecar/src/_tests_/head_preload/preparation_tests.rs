//! A head describe wakes Serve, and each idle head process then loads the generation in turn.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::pool::{ReturnWake, ReturnWakeMock, SidecarPool};

use super::calls::call;
use super::support::Harness;

#[test]
fn a_head_describe_prepares_each_idle_head_process_one_at_a_time() {
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
            call(1, "describe g"),
            call(2, "restoreGeneration g"),
            call(2, "cssModules g"),
            call(2, "describe g"),
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
