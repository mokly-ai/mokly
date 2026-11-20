//! A returned head process prepares the newest head generation and replays its latest renders.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::calls::{call, css, prepared, replayed, views};
use super::support::{Event, Gate, Harness};

#[test]
fn a_returned_process_prepares_the_newest_head_generation_then_replays_its_30_latest_renders() {
    let harness = Harness::plain(1);
    let rendered = views("view", 32);
    harness.head("g", &rendered);
    harness.base();
    harness.returned();
    let steps = harness.maintain();
    let spawns = harness.events.spawns();
    let warmed = harness.events.calls(2);
    let quiet = [harness.events.quiet(0), harness.events.quiet(2)];
    harness.pool.abort().unwrap();
    let mut expected = prepared("g");
    expected.extend(replayed("g", &rendered[2..]));
    assert_eq!(steps, 1);
    assert_eq!(spawns, 3, "the warm-up starts no process");
    assert_eq!(warmed, expected);
    assert_eq!(
        quiet,
        [Vec::new(), expected],
        "only warm-up calls are quiet"
    );
}

#[test]
fn every_return_step_comes_first_and_one_process_warms_up_at_a_time() {
    let hold = Arc::new(Gate::default());
    let restore = Arc::new(Gate::default());
    let (held_base, held_restore) = (hold.clone(), restore.clone());
    let harness = Harness::new(
        2,
        Arc::new(move |event| {
            if *event == call(1, "hold") {
                held_base.block();
            }
            if *event == call(3, "restoreGeneration g") {
                held_restore.block();
            }
            Ok(())
        }),
    );
    let rendered = views("view", 2);
    harness.head("g", &rendered);
    let pool = harness.pool.clone();
    let busy = thread::spawn(move || pool.request(css("/base", "hold")).unwrap());
    hold.entered();
    harness.pool.request(css("/base", "second")).unwrap();
    hold.open();
    busy.join().unwrap();
    harness.pool.schedule_head_return();
    let returned = [
        harness.pool.maintain_head_return().unwrap(),
        harness.pool.maintain_head_return().unwrap(),
    ];
    let pool = harness.pool.clone();
    let first = thread::spawn(move || pool.maintain_head_return().unwrap());
    restore.entered();
    let concurrent = harness.pool.maintain_head_return().unwrap();
    restore.open();
    let first = first.join().unwrap();
    let rest = harness.maintain();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    let mut warmed = prepared("g");
    warmed.extend(replayed("g", &rendered));
    let warm_ups = events
        .iter()
        .filter_map(|event| match event {
            Event::Call(process, label) if *process >= 3 => Some((*process, label.clone())),
            _ => None,
        })
        .collect::<Vec<_>>();
    let last_spawn = events
        .iter()
        .rposition(|event| matches!(event, Event::Spawn(_, _)));
    let first_warm_up = events
        .iter()
        .position(|event| matches!(event, Event::Call(3, _)));
    assert_eq!(returned, [true, true]);
    assert!(!concurrent, "a second warm-up waits for the call in flight");
    assert!(first);
    assert_eq!(rest, 1);
    assert_eq!(
        warm_ups,
        [3, 4]
            .into_iter()
            .flat_map(|process| warmed.iter().map(move |label| (process, label.clone())))
            .collect::<Vec<_>>()
    );
    assert!(
        first_warm_up > last_spawn,
        "both return steps come before the first warm-up call"
    );
}
