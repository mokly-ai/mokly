//! Counters distinguish completion, actual render adoption, cancellation, and stop.

use std::sync::Arc;
use std::thread;

use mokly_test_support::capture::Trace;

use crate::error::{Error, RemoteCode, RequestCode};
use crate::pool::SidecarPool;

use super::super::calls::{bindings, call, maps, render};
use super::super::support::Gate;
use super::support::{describe, edit, finish, paired, start, step};

pub(super) fn counts(trace: &Trace, key: &str) -> u64 {
    trace
        .events()
        .iter()
        .flat_map(|event| &event.fields)
        .filter(|(name, _)| name == key)
        .map(|(_, value)| value.parse::<u64>().unwrap())
        .sum()
}

#[test]
fn a_complete_preparation_survives_publication_and_a_failed_real_render_adopts_once() {
    let trace = Trace::default();
    trace.in_scope(|| {
        let hold = Arc::new(Gate::default());
        let held = hold.clone();
        let harness = paired(Arc::new(move |event| {
            if *event == call(0, &render("new", "bundler").to_string()) {
                held.block();
            }
            if *event == call(1, &render("new", "one").to_string()) {
                return Err(Error::Remote {
                    code: RemoteCode::Request(RequestCode::BundleFailed),
                    message: "injected".into(),
                });
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
        assert_eq!(
            (
                counts(&trace, "started"),
                counts(&trace, "adopted"),
                counts(&trace, "aborted")
            ),
            (1, 0, 0)
        );
        let pool = harness.pool.clone();
        let bundler = thread::spawn(move || pool.request(render("new", "bundler")).unwrap());
        hold.entered();
        let result = harness.pool.request(render("new", "one"));
        hold.open();
        bundler.join().unwrap();
        assert!(matches!(
            result,
            Err(Error::Remote {
                code: RemoteCode::Request(RequestCode::BundleFailed),
                ..
            })
        ));
        harness.pool.request(render("new", "two")).unwrap();
        harness.pool.abort().unwrap();
        assert_eq!(
            (
                counts(&trace, "started"),
                counts(&trace, "adopted"),
                counts(&trace, "aborted")
            ),
            (1, 1, 0)
        );
    });
}

#[test]
fn a_new_bundle_and_stop_abort_unused_markers_once() {
    let trace = Trace::default();
    trace.in_scope(|| {
        let harness = paired(Arc::new(|_| Ok(())));
        start(&harness, "new");
        assert!(step(&harness));
        harness.pool.request(maps("new")).unwrap();
        describe(&harness, "new");
        finish(&harness);
        harness.pool.head_published();
        harness.pool.request(edit("second")).unwrap();
        assert_eq!(counts(&trace, "aborted"), 1);
        assert!(step(&harness));
        harness.pool.abort().unwrap();
        harness.pool.abort().unwrap();
        assert!(!step(&harness));
        let not_started = paired(Arc::new(|_| Ok(())));
        start(&not_started, "never-started");
        not_started.pool.abort().unwrap();
        assert_eq!(
            (
                counts(&trace, "started"),
                counts(&trace, "adopted"),
                counts(&trace, "aborted")
            ),
            (2, 0, 2)
        );
    });
}
