//! A completed base pass returns existing capacity before another head call.

use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Harness, css};

#[test]
fn an_idle_base_process_is_reaped_then_ready_before_the_next_head_call() {
    let harness = Harness::plain(1, &[Mode::Base, Mode::Foreground]);
    let pool = &harness.pool;
    pool.request(css("/base", "base")).unwrap();
    pool.schedule_head_return();
    let returned = pool.maintain_head_return().unwrap();
    let prepared = harness.events.read();
    pool.request(css("/head", "head")).unwrap();
    let served = harness.events.read();
    pool.abort().unwrap();
    assert!(returned, "the completed pass must take its idle base slot");
    assert_eq!(
        prepared,
        [
            Event::Spawn(0, "/base".into()),
            Event::Hello(0),
            Event::Request(0, "base".into()),
            Event::Kill(0),
            Event::Reap(0),
            Event::Spawn(1, "/head".into()),
            Event::Hello(1)
        ]
    );
    assert_eq!(served.last(), Some(&Event::Request(1, "head".into())));
}
