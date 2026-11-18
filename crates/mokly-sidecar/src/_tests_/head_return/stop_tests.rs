//! Stops end a leased hello and prohibit any later publication or process start.

use std::sync::Arc;
use std::thread;

use crate::error::Error;
use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Gate, Harness, css};

#[derive(Clone, Copy, Debug)]
enum Stop {
    Cancel,
    Shutdown,
    Abort,
}

#[test]
fn every_stop_ends_the_hello_without_publishing_a_replacement() {
    for stop in [Stop::Cancel, Stop::Shutdown, Stop::Abort] {
        let gate = Arc::new(Gate::default());
        let hello = gate.clone();
        let harness = Harness::new(
            1,
            &[
                Mode::Base,
                match stop {
                    Stop::Shutdown => Mode::ShutdownHello,
                    Stop::Cancel | Stop::Abort => Mode::Hello,
                },
            ],
            Arc::new(move |event| {
                if event == Event::Hello(1) {
                    hello.block();
                }
            }),
        );
        harness.pool.request(css("/base", "base")).unwrap();
        harness.pool.schedule_head_return();
        let pool = harness.pool.clone();
        let maintenance = thread::spawn(move || pool.maintain_head_return());
        gate.entered();
        match stop {
            Stop::Cancel => harness.pool.cancel_requests().unwrap(),
            Stop::Shutdown => harness.pool.shutdown().unwrap(),
            Stop::Abort => harness.pool.abort().unwrap(),
        }
        gate.open();
        assert!(maintenance.join().unwrap().unwrap());
        let outcome = harness.pool.request(css("/head", "late"));
        let events = harness.events.read();
        assert!(matches!(outcome, Err(Error::Cancelled)), "{stop:?}");
        assert!(
            harness.pool.lock().slots.iter().all(Option::is_none),
            "{stop:?}"
        );
        assert!(events.contains(&Event::Kill(1)), "{stop:?}");
        assert!(events.contains(&Event::Reap(1)), "{stop:?}");
        assert_eq!(
            events
                .iter()
                .filter(|event| matches!(event, Event::Spawn(_, _)))
                .count(),
            2,
            "{stop:?}"
        );
    }
}

#[test]
fn stopping_a_recorded_pass_starts_no_maintenance_process() {
    let harness = Harness::plain(1, &[Mode::IdleShutdown]);
    harness.pool.request(css("/base", "base")).unwrap();
    harness.pool.schedule_head_return();
    harness.pool.cancel_requests().unwrap();
    let worked = harness.pool.maintain_head_return().unwrap();
    let events = harness.events.read();
    harness.pool.shutdown().unwrap();
    assert!(!worked);
    assert_eq!(
        events,
        [
            Event::Spawn(0, "/base".into()),
            Event::Hello(0),
            Event::Request(0, "base".into())
        ]
    );
}
