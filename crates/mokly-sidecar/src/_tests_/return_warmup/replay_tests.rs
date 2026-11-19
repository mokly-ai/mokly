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
