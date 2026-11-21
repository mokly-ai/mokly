//! A bundle failure and every stop discard started work without a late second count.

use std::sync::Arc;
use std::thread;

use mokly_test_support::capture::Trace;

use crate::error::{Error, RemoteCode, RequestCode};
use crate::pool::SidecarPool;

use super::super::calls::{bindings, call, maps, render};
use super::super::support::{Gate, Harness};
use super::counter_tests::counts;
use super::support::{describe, edit, finish, paired, start, step};

type Stop = fn(&Harness);

#[test]
fn a_stop_during_ordinary_binding_preparation_does_not_count_render_adoption() {
    let trace = Trace::default();
    trace.in_scope(|| {
        let old = Arc::new(Gate::default());
        let held_old = old.clone();
        let binding = Arc::new(Gate::default());
        let held_binding = binding.clone();
        let harness = paired(Arc::new(move |event| {
            if *event == call(0, &render("old", "held").to_string()) {
                held_old.block();
            }
            if *event == call(1, "bindings new") {
                held_binding.block();
            }
            Ok(())
        }));
        start(&harness, "new");
        assert!(step(&harness));
        harness.pool.request(maps("new")).unwrap();
        describe(&harness, "new");
        harness.pool.request(bindings("new")).unwrap();
        finish(&harness);
        harness.pool.head_published();
        let pool = harness.pool.clone();
        let older = thread::spawn(move || pool.request(render("old", "held")));
        old.entered();
        let pool = harness.pool.clone();
        let captured = trace.clone();
        let rendering = thread::spawn(move || {
            captured.in_scope(|| pool.request(render("new", "never-attempted")))
        });
        binding.entered();
        harness.pool.cancel_requests().unwrap();
        binding.open();
        old.open();
        assert!(matches!(rendering.join().unwrap(), Err(Error::Cancelled)));
        assert!(matches!(older.join().unwrap(), Err(Error::Cancelled)));
        assert!(
            !harness
                .events
                .calls(1)
                .contains(&render("new", "never-attempted").to_string())
        );
        assert_eq!(
            (
                counts(&trace, "started"),
                counts(&trace, "aborted"),
                counts(&trace, "adopted")
            ),
            (1, 1, 0)
        );
    });
}

#[test]
fn each_stop_aborts_an_inflight_preparation_once_and_sends_no_later_call() {
    let stops: [Stop; 3] = [
        |harness| harness.pool.cancel_requests().unwrap(),
        |harness| harness.pool.shutdown().unwrap(),
        |harness| harness.pool.abort().unwrap(),
    ];
    for stop in stops {
        let trace = Trace::default();
        trace.in_scope(|| {
            let restore = Arc::new(Gate::default());
            let held = restore.clone();
            let harness = paired(Arc::new(move |event| {
                if *event == call(1, "restoreGeneration new") {
                    held.block();
                }
                Ok(())
            }));
            start(&harness, "new");
            assert!(step(&harness));
            let pool = harness.pool.clone();
            let restoring = thread::spawn(move || pool.maintain_head_preparation().unwrap());
            restore.entered();
            stop(&harness);
            restore.open();
            assert!(restoring.join().unwrap());
            assert!(!step(&harness));
            assert_eq!(
                (
                    counts(&trace, "started"),
                    counts(&trace, "aborted"),
                    counts(&trace, "adopted")
                ),
                (1, 1, 0)
            );
        });
    }
}

#[test]
fn failed_bundles_and_failed_early_calls_end_their_started_marker() {
    for bundle_failure in [true, false] {
        let trace = Trace::default();
        trace.in_scope(|| {
            let harness = paired(Arc::new(move |event| {
                if *event == call(0, "bundle bad")
                    || !bundle_failure && *event == call(1, "restoreGeneration new")
                {
                    return Err(Error::Remote {
                        code: RemoteCode::Request(RequestCode::BundleFailed),
                        message: "injected".into(),
                    });
                }
                Ok(())
            }));
            start(&harness, "new");
            assert!(step(&harness));
            if bundle_failure {
                assert!(matches!(
                    harness.pool.request(edit("bad")),
                    Err(Error::Remote {
                        code: RemoteCode::Request(RequestCode::BundleFailed),
                        ..
                    })
                ));
            } else {
                assert!(step(&harness));
            }
            assert!(!step(&harness));
            harness.pool.abort().unwrap();
            assert_eq!(
                (
                    counts(&trace, "started"),
                    counts(&trace, "aborted"),
                    counts(&trace, "adopted")
                ),
                (1, 1, 0)
            );
        });
    }
}
