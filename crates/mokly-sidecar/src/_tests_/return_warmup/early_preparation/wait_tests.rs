//! Published-state waits measure only the interval caused by the newer-only process.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;

use mokly_test_support::capture::Trace;
use mokly_test_support::records::{CapturedEvent, EventObserver};
use unimock::{MockFn, Unimock, matching};

use crate::methods::{Call, Generation};
use crate::pool::SidecarPool;
use crate::workers::ClockMock;

use super::super::calls::{call, css, maps, render};
use super::super::support::Gate;
use super::support::{finish, paired_clock, start, step};

struct IntervalEnded(Arc<Gate>);

impl EventObserver for IntervalEnded {
    fn event(&self, event: &CapturedEvent) {
        if event
            .fields
            .iter()
            .any(|(key, _)| key == "published_wait_ms")
        {
            self.0.block();
        }
    }
}

#[test]
fn an_older_published_render_waits_for_the_bundler_and_counts_only_its_forced_wait() {
    let now = Arc::new(AtomicU64::new(100));
    let read = now.clone();
    let clock = Unimock::new(
        ClockMock::now_ms
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| read.load(Ordering::SeqCst))),
    );
    let hold = Arc::new(Gate::default());
    let held = hold.clone();
    let occupied = Arc::new(Gate::default());
    let busy = occupied.clone();
    let harness = paired_clock(
        Arc::new(move |event| {
            if *event == call(0, "describe new") {
                held.block();
            }
            if *event == call(1, "occupied") {
                busy.block();
            }
            Ok(())
        }),
        Arc::new(clock),
    );
    start(&harness, "new");
    assert!(step(&harness));
    harness.pool.request(maps("new")).unwrap();
    let pool = harness.pool.clone();
    let bundler = thread::spawn(move || {
        pool.request(Call::Describe(Generation {
            generation: "new".into(),
        }))
        .unwrap()
    });
    hold.entered();
    finish(&harness);
    let interval = Arc::new(Gate::default());
    let trace = Trace::with_observer(Arc::new(IntervalEnded(interval.clone())));
    let captured = trace.clone();
    let pool = harness.pool.clone();
    let old = thread::spawn(move || captured.in_scope(|| pool.request(render("old", "request"))));
    harness.waiting(1);
    now.store(147, Ordering::SeqCst);
    let pool = harness.pool.clone();
    let occupying = thread::spawn(move || pool.request(css("/head", "occupied")).unwrap());
    interval.entered();
    now.store(1_000, Ordering::SeqCst);
    interval.open();
    occupied.entered();
    hold.open();
    bundler.join().unwrap();
    old.join().unwrap().unwrap();
    occupied.open();
    occupying.join().unwrap();
    let fields = trace
        .events()
        .into_iter()
        .flat_map(|event| event.fields)
        .collect::<Vec<_>>();
    assert_eq!(
        fields
            .iter()
            .filter(|(key, _)| key == "published_waits")
            .map(|(_, value)| value.parse::<u64>().unwrap())
            .sum::<u64>(),
        1
    );
    assert_eq!(
        fields
            .iter()
            .filter(|(key, _)| key == "published_wait_ms")
            .map(|(_, value)| value.parse::<u64>().unwrap())
            .sum::<u64>(),
        47
    );
    assert!(
        !harness
            .events
            .calls(1)
            .contains(&render("old", "request").to_string())
    );
    harness.pool.head_published();
    harness.pool.abort().unwrap();
}
