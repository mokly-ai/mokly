//! Later base calls cancel one slot and a new publication owns a fresh pass.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Gate, Harness, css};

#[test]
fn sequential_later_base_calls_keep_their_slot_while_other_candidates_return() {
    let gates = Arc::new([Gate::default(), Gate::default()]);
    let held = gates.clone();
    let harness = Harness::new(
        3,
        &[
            Mode::Base,
            Mode::Base,
            Mode::Base,
            Mode::Ready,
            Mode::Ready,
            Mode::Ready,
        ],
        Arc::new(move |event| {
            if event == Event::Request(0, "hold-0".into()) {
                held[0].block();
            }
            if event == Event::Request(1, "hold-1".into()) {
                held[1].block();
            }
        }),
    );
    let mut jobs = Vec::new();
    for index in 0..2 {
        let pool = harness.pool.clone();
        jobs.push(thread::spawn(move || {
            pool.request(css("/base", &format!("hold-{index}")))
                .unwrap()
        }));
        gates[index].entered();
    }
    harness.pool.request(css("/base", "idle")).unwrap();
    for (gate, job) in gates.iter().zip(jobs) {
        gate.open();
        job.join().unwrap();
    }
    let pool = &harness.pool;
    pool.schedule_head_return();
    pool.request(css("/base", "later-first")).unwrap();
    pool.request(css("/base", "later-second")).unwrap();
    let mut returned = 0;
    while pool.maintain_head_return().unwrap() {
        returned += 1;
    }
    let first = harness.events.read();
    pool.schedule_head_return();
    let fresh = pool.maintain_head_return().unwrap();
    let second = harness.events.read();
    pool.abort().unwrap();
    assert_eq!(returned, 2);
    assert_eq!(
        first
            .iter()
            .filter(|event| matches!(event, Event::Kill(_)))
            .cloned()
            .collect::<Vec<_>>(),
        [Event::Kill(0), Event::Kill(1)]
    );
    assert!(first.contains(&Event::Request(2, "later-second".into())));
    assert!(fresh);
    assert!(second.contains(&Event::Kill(2)));
}

#[test]
fn a_new_publication_during_reaping_keeps_its_remaining_candidates() {
    for phase in [Event::Reap(1), Event::Hello(2)] {
        let busy = Arc::new(Gate::default());
        let held = busy.clone();
        let reap = Arc::new(Gate::default());
        let reaping = reap.clone();
        let held_phase = phase.clone();
        let harness = Harness::new(
            2,
            &[Mode::Base, Mode::Base, Mode::Ready, Mode::Ready],
            Arc::new(move |event| {
                if event == Event::Request(0, "hold".into()) {
                    held.block();
                }
                if event == held_phase {
                    reaping.block();
                }
            }),
        );
        let pool = harness.pool.clone();
        let held_request = thread::spawn(move || pool.request(css("/base", "hold")).unwrap());
        busy.entered();
        harness.pool.request(css("/base", "idle")).unwrap();
        harness.pool.schedule_head_return();
        let pool = harness.pool.clone();
        let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
        reap.entered();
        harness.pool.schedule_head_return();
        busy.open();
        held_request.join().unwrap();
        reap.open();
        assert!(maintenance.join().unwrap());
        let remaining = harness.pool.maintain_head_return().unwrap();
        let events = harness.events.read();
        harness.pool.abort().unwrap();
        assert!(
            remaining,
            "the new pass must keep the slot that became idle"
        );
        assert_eq!(
            events
                .iter()
                .filter(|event| matches!(event, Event::Kill(_)))
                .cloned()
                .collect::<Vec<_>>(),
            [Event::Kill(1), Event::Kill(0)]
        );
        assert!(harness.pool.lock().head.candidates.is_empty());
    }
}
