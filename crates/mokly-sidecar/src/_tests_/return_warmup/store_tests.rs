//! Store-served calls use the same bounded warm-up after committed Changes.

use std::path::Path;
use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::calls::{call, render, replayed, views};
use super::support::{Gate, Harness};

#[test]
fn stored_renders_warm_an_existing_head_process_only_after_changes_and_never_repeat() {
    let harness = Harness::plain(1);
    harness.head("g", &[]);
    let before = harness.events.read();
    let rendered = views("stored", 32);
    for view in &rendered {
        harness
            .pool
            .record_served_render(Path::new("/head"), render("g", view));
    }
    harness
        .pool
        .record_served_render(Path::new("/head"), render("g", "stored-32"));
    harness
        .pool
        .record_served_render(Path::new("/base"), render("g", "base-same-generation"));
    harness
        .pool
        .record_served_render(Path::new("/head"), render("older", "old"));
    assert_eq!(harness.events.read(), before, "recording sends no call");
    assert!(!harness.pool.maintain_head_return().unwrap());
    harness.pool.schedule_head_return();
    assert_eq!(harness.maintain(), 1, "the existing head process warms");
    let expected = replayed("g", &rendered[2..]);
    assert_eq!(harness.events.quiet(0), expected);
    assert_eq!(harness.events.spawns(), 1, "warm-up starts no process");
    let completed = harness.events.read();
    harness.pool.schedule_head_return();
    assert_eq!(harness.maintain(), 0, "a completed warm-up never restarts");
    assert_eq!(harness.events.read(), completed);
    harness.pool.abort().unwrap();
}

#[test]
fn store_deduplication_does_not_change_successful_render_order_or_duplicates() {
    let harness = Harness::plain(1);
    harness.head("g", &["normal".into(), "normal".into()]);
    for view in ["normal", "stored", "stored"] {
        harness
            .pool
            .record_served_render(Path::new("/head"), render("g", view));
    }
    harness.base();
    harness.returned();
    harness.maintain();
    assert_eq!(
        harness.events.quiet(2),
        super::calls::prepared("g")
            .into_iter()
            .chain(replayed(
                "g",
                &[
                    "normal".into(),
                    "normal".into(),
                    "normal".into(),
                    "stored".into()
                ]
            ))
            .collect::<Vec<_>>()
    );
    harness.pool.abort().unwrap();
}

#[test]
fn a_same_generation_request_and_publication_preserve_the_cold_heads_remaining_replays() {
    let blocked = Arc::new(Gate::default());
    let gate = blocked.clone();
    let harness = Harness::new(
        1,
        Arc::new(move |event| {
            if *event == call(0, "first export default") {
                gate.block();
            }
            Ok(())
        }),
    );
    harness.head("g", &[]);
    for view in ["first", "second"] {
        harness
            .pool
            .record_served_render(Path::new("/head"), render("g", view));
    }
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let warming = thread::spawn(move || pool.maintain_head_return().unwrap());
    blocked.entered();
    let pool = harness.pool.clone();
    let request = thread::spawn(move || pool.request(render("g", "foreground")).unwrap());
    harness.waiting(1);
    harness.pool.schedule_head_return();
    blocked.open();
    assert!(warming.join().unwrap());
    request.join().unwrap();
    assert_eq!(harness.events.quiet(0), ["first export default"]);
    harness.pool.schedule_head_return();
    assert_eq!(
        harness.maintain(),
        1,
        "the paused attempt continues after a successful render"
    );
    assert_eq!(
        harness.events.quiet(0),
        ["first export default", "second export default"]
    );
    assert_eq!(
        &harness.events.calls(0)[4..],
        [
            "first export default",
            "foreground export default",
            "second export default",
        ]
    );
    harness.pool.abort().unwrap();
}
