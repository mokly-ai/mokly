//! Admission distinguishes running claimed calls from claims still in transit.

use std::sync::Arc;
use std::thread;

use mokly_test_support::capture::Trace;

use crate::methods::{Call, Generation};
use crate::pool::SidecarPool;
use crate::pool_admission::PoolCapacity;

use super::super::calls::{call, css, maps};
use super::super::support::Gate;
use super::counter_tests::counts;
use super::support::{finish, paired, start, step};

#[test]
fn a_claim_in_transit_pauses_early_work_without_restarting_it() {
    let trace = Trace::default();
    trace.in_scope(|| {
        let harness = paired(Arc::new(|_| Ok(())));
        start(&harness, "new");
        let claim = harness.pool.try_claim().unwrap().unwrap();
        assert!(
            !step(&harness),
            "an admitted claim has not reached the queue"
        );
        drop(claim);
        assert!(step(&harness), "early work resumes after the claim ends");
        let claim = harness.pool.try_claim().unwrap().unwrap();
        assert!(!step(&harness));
        drop(claim);
        assert!(step(&harness));
        harness.pool.abort().unwrap();
        assert_eq!(
            (counts(&trace, "started"), counts(&trace, "aborted")),
            (1, 1)
        );
    });
}

#[test]
fn early_preparation_overlaps_a_claimed_description_on_the_bundling_process() {
    let describe = Arc::new(Gate::default());
    let held = describe.clone();
    let harness = paired(Arc::new(move |event| {
        if *event == call(0, "describe new") {
            held.block();
        }
        Ok(())
    }));
    start(&harness, "new");
    harness.pool.request(maps("new")).unwrap();
    let claim = harness.pool.try_claim().unwrap().unwrap();
    let pool = harness.pool.clone();
    let describing = thread::spawn(move || {
        pool.request_claimed(
            Call::Describe(Generation {
                generation: "new".into(),
            }),
            &claim,
        )
    });
    describe.entered();
    let progressed = step(&harness);
    finish(&harness);
    let prepared = harness.events.quiet(1);
    describe.open();
    describing.join().unwrap().unwrap();
    harness.pool.abort().unwrap();
    assert!(
        progressed,
        "a running bundler claim permits early preparation"
    );
    assert_eq!(
        prepared,
        [
            "dispose old",
            "restoreGeneration new",
            "cssModules new",
            "describe new"
        ]
    );
}

#[test]
fn a_live_current_attempt_postcss_context_excludes_the_other_head_process() {
    let harness = paired(Arc::new(|_| Ok(())));
    harness.pool.begin_head_attempt("current");
    harness.pool.request(css("/head", "current")).unwrap();
    start(&harness, "new");
    let before = harness.events.read();
    assert!(!step(&harness));
    assert_eq!(harness.events.read(), before);
    harness.pool.release_context("current");
    harness.pool.synchronize_releases();
    assert!(
        step(&harness),
        "a released context no longer excludes its process"
    );
    harness.pool.abort().unwrap();
}
