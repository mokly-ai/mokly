//! Replays count toward the render limit and leave the warm head process where requests put it.

use crate::pool::SidecarPool;

use super::calls::{css, render, views};
use super::support::{Event, Harness};

#[test]
fn replayed_renders_count_toward_the_render_limit_of_the_process() {
    let harness = Harness::plain(1);
    harness.head("g", &views("view", 2));
    harness.base();
    harness.returned();
    harness.maintain();
    let reaped = |harness: &Harness| harness.events.read().contains(&Event::Reap(2));
    for _ in 0..497 {
        harness.pool.request(render("g", "view-1")).unwrap();
    }
    let before_limit = reaped(&harness);
    harness.pool.request(render("g", "view-1")).unwrap();
    let at_limit = reaped(&harness);
    harness.pool.abort().unwrap();
    assert_eq!(
        (before_limit, at_limit),
        (false, true),
        "two replays and 498 requests reach the limit of 500 renders"
    );
}

#[test]
fn warm_up_ends_before_a_replay_reaches_the_process_render_limit() {
    for (renders, expected_replays) in [(499, 0), (498, 1)] {
        let harness = Harness::plain(1);
        harness.head("g", &views("view", 2));
        harness.base();
        harness.returned();
        for _ in 0..renders {
            harness.pool.request(render("g", "view-1")).unwrap();
        }
        let spawns_before = harness.events.spawns();
        let steps = harness.maintain();
        let replays = harness.events.quiet(2);
        let spawns_after = harness.events.spawns();
        let retired_before = harness.events.read().contains(&Event::Reap(2));
        let calls_before = harness.events.calls(2).len();
        harness.pool.request(render("g", "view-1")).unwrap();
        let normal = harness.events.calls(2)[calls_before..].to_vec();
        let retired_after = harness.events.read().contains(&Event::Reap(2));
        let spawns_final = harness.events.spawns();
        harness.pool.abort().unwrap();
        assert_eq!(steps, 1, "{renders} renders: the warm-up ends");
        assert_eq!(replays.len(), expected_replays, "{renders} normal renders");
        assert_eq!(spawns_after, spawns_before, "warm-up starts no process");
        assert_eq!(
            spawns_final, spawns_before,
            "the next render uses process 2"
        );
        assert_eq!(normal, [render("g", "view-1").to_string()]);
        assert_eq!(
            (retired_before, retired_after),
            (false, true),
            "{renders} renders: the next normal render retires process 2 at 500"
        );
    }
}

#[test]
fn a_replay_does_not_move_the_warm_head_process() {
    let harness = Harness::plain(2);
    harness.head("g", &views("view", 2));
    harness.base();
    harness.returned();
    let warmed = harness.maintain();
    let before = harness.events.read().len();
    harness.pool.request(css("/base", "later")).unwrap();
    let killed = harness.events.read()[before..]
        .iter()
        .filter(|event| matches!(event, Event::Kill(_)))
        .cloned()
        .collect::<Vec<_>>();
    harness.pool.abort().unwrap();
    assert_eq!(warmed, 1);
    assert_eq!(
        killed,
        [Event::Kill(2)],
        "the base call replaces the warmed process and keeps the bundling process"
    );
}
