//! Requests take the process after the call in flight, and the warm-up continues when idle.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::pool::{ReturnWake, ReturnWakeMock, SidecarPool};
use crate::pool_admission::PoolCapacity;

use super::calls::{call, css, prepared, replayed, views};
use super::support::{Gate, Harness};

#[test]
fn a_waiting_request_takes_the_process_after_the_call_in_flight_and_the_warm_up_resumes() {
    let restore = Arc::new(Gate::default());
    let held = restore.clone();
    let harness = Harness::new(
        1,
        Arc::new(move |event| {
            if *event == call(2, "restoreGeneration g") {
                held.block();
            }
            Ok(())
        }),
    );
    let wakes = Arc::new(AtomicUsize::new(0));
    let counted = wakes.clone();
    let wake: Arc<dyn ReturnWake> = Arc::new(
        Unimock::new(
            ReturnWakeMock::notify
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    counted.fetch_add(1, Ordering::SeqCst);
                })),
        )
        .no_verify_in_drop(),
    );
    harness.pool.observe_head_return(Arc::downgrade(&wake));
    let rendered = views("view", 2);
    harness.head("g", &rendered);
    harness.base();
    harness.returned();
    let pool = harness.pool.clone();
    let warming = thread::spawn(move || pool.maintain_head_return().unwrap());
    restore.entered();
    let before = wakes.load(Ordering::SeqCst);
    let pool = harness.pool.clone();
    let request = thread::spawn(move || pool.request(css("/head", "next")).unwrap());
    harness.waiting(1);
    restore.open();
    let stepped = warming.join().unwrap();
    request.join().unwrap();
    let woken = wakes.load(Ordering::SeqCst) > before;
    let interrupted = harness.events.calls(2);
    let resumed = harness.maintain();
    let spawns = harness.events.spawns();
    let warmed = harness.events.calls(2);
    let quiet = harness.events.quiet(2);
    harness.pool.abort().unwrap();
    let mut expected = vec!["restoreGeneration g".to_owned(), "next".to_owned()];
    expected.extend(prepared("g").into_iter().skip(1));
    expected.extend(replayed("g", &rendered));
    let mut warm_up = prepared("g");
    warm_up.extend(replayed("g", &rendered));
    assert!(stepped);
    assert!(woken, "a pending warm-up wakes the maintenance owner");
    assert_eq!(interrupted, ["restoreGeneration g", "next"]);
    assert_eq!(resumed, 1);
    assert_eq!(spawns, 3, "the waiting request starts no process");
    assert_eq!(warmed, expected);
    assert_eq!(
        quiet, warm_up,
        "the request between warm-up calls is not quiet"
    );
}

#[test]
fn a_call_that_serve_admitted_pauses_the_warm_up_until_its_claim_ends() {
    let restore = Arc::new(Gate::default());
    let held = restore.clone();
    let harness = Harness::new(
        2,
        Arc::new(move |event| {
            if *event == call(2, "restoreGeneration g") {
                held.block();
            }
            Ok(())
        }),
    );
    let rendered = views("view", 2);
    harness.head("g", &rendered);
    harness.base();
    harness.returned();
    let pool = harness.pool.clone();
    let warming = thread::spawn(move || pool.maintain_head_return().unwrap());
    restore.entered();
    let (stepped, paused, while_claimed) = {
        let _claim = harness.pool.try_claim().unwrap().unwrap();
        restore.open();
        let stepped = warming.join().unwrap();
        let paused = harness.events.calls(2);
        (
            stepped,
            paused,
            harness.pool.maintain_head_return().unwrap(),
        )
    };
    let resumed = harness.maintain();
    let warmed = harness.events.calls(2);
    harness.pool.abort().unwrap();
    let mut expected = prepared("g");
    expected.extend(replayed("g", &rendered));
    assert!(stepped);
    assert_eq!(paused, ["restoreGeneration g"]);
    assert!(
        !while_claimed,
        "no warm-up call runs beside an admitted call"
    );
    assert_eq!(resumed, 1);
    assert_eq!(warmed, expected);
}
