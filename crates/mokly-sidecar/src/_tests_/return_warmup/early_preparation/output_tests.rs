//! Quiet evaluation must not consume the ordinary description's visible evaluation output.

use std::sync::Arc;
use std::thread;

use mokly_test_support::capture::Trace;

use crate::methods::{Call, Generation};
use crate::pool::SidecarPool;

use super::super::calls::{bindings, call, maps, render};
use super::super::support::Gate;
use super::counter_tests::counts;
use super::support::{finish, paired, start, step};

#[test]
fn the_ordinary_description_evaluates_visibly_when_an_older_render_holds_the_bundler() {
    let hold = Arc::new(Gate::default());
    let held = hold.clone();
    let harness = paired(Arc::new(move |event| {
        if *event == call(0, &render("old", "held").to_string()) {
            held.block();
        }
        Ok(())
    }));
    start(&harness, "new");
    assert!(step(&harness));
    harness.pool.request(maps("new")).unwrap();
    finish(&harness);
    let pool = harness.pool.clone();
    let old = thread::spawn(move || pool.request(render("old", "held")).unwrap());
    hold.entered();
    harness
        .pool
        .request(Call::Describe(Generation {
            generation: "new".into(),
        }))
        .unwrap();
    hold.open();
    old.join().unwrap();
    harness.pool.request(bindings("new")).unwrap();
    harness.pool.head_published();
    let trace = Trace::default();
    trace.in_scope(|| harness.pool.request(render("new", "first")).unwrap());
    let quiet = harness.events.quiet(1);
    let calls = harness.events.calls(1);
    harness.pool.abort().unwrap();
    assert!(
        !quiet.contains(&"describe new".to_owned()),
        "an early quiet description must not consume the ordinary evaluation output"
    );
    assert_eq!(
        calls
            .iter()
            .filter(|label| *label == "describe new")
            .count(),
        1
    );
    assert_eq!(
        counts(&trace, "adopted"),
        1,
        "the successful ordinary description completed the early inputs"
    );
}
