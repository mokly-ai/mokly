//! Indexed target resolution keeps empty targets and cancellation visible to callers.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_model::runtime_diagnostic::RuntimeCode;
use unimock::{MockFn, Unimock, matching};

use crate::error::GraphError;
use crate::link_results::{self, LinkResultsMock};
use crate::types::RenderGeneration;
use crate::validation;
use crate::workers::RenderWorkersMock;

use super::validation_cache_tests::reference;
use super::validation_completed_tests::views;
use super::validation_sharing_tests::sharing;

#[test]
fn known_targets_without_views_succeed_and_completed_unknowns_keep_the_view_route() {
    let probe = sharing(false, false, link_results::LIMIT);
    probe
        .session
        .comparison_document("target/index.desktop.html")
        .unwrap();
    probe.reads.store(0, Ordering::SeqCst);
    for target in ["zero", "empty", "orphan"] {
        validation::links(&probe.session, &[reference(target, "absent")]).unwrap();
        let mut completed = views(false);
        for view in completed.values_mut() {
            view.links = vec![reference(target, "absent")];
        }
        validation::completed(&probe.session, &completed).unwrap();
    }
    assert_eq!(probe.reads.load(Ordering::SeqCst), 0);
    assert_eq!(probe.session.state.link_results.len(), 0);
    let mut completed = views(false);
    for view in completed.values_mut() {
        view.links = vec![reference("unknown", "summary")];
    }
    let error = validation::completed(&probe.session, &completed).unwrap_err();
    let GraphError::Invalid { route, message, .. } = error else {
        panic!("expected unknown target")
    };
    assert_eq!(route, "target/index.desktop.dark.html");
    assert_eq!(message, "unknown logical destination");
}

#[test]
fn cancellation_is_checked_for_pair_hits_before_and_after_the_flight_lock() {
    for initial_miss in [false, true] {
        let mut probe = sharing(false, false, link_results::LIMIT);
        probe
            .session
            .comparison_document("target/index.desktop.html")
            .unwrap();
        probe.reads.store(0, Ordering::SeqCst);
        let lookups = Arc::new(AtomicUsize::new(0));
        let calls = lookups.clone();
        let state = Arc::get_mut(&mut probe.session.state).unwrap();
        state.link_results = Arc::new(Unimock::new(
            LinkResultsMock::get
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| {
                    if calls.fetch_add(1, Ordering::SeqCst) == 0 && initial_miss {
                        None
                    } else {
                        Some(true)
                    }
                })),
        ));
        state.workers = Arc::new(Unimock::new(
            RenderWorkersMock::cancelled
                .each_call(matching!())
                .returns(true),
        ));
        let error =
            validation::links(&probe.session, &[reference("target", "summary")]).unwrap_err();
        let GraphError::Runtime { source } = error else {
            panic!("expected cancellation")
        };
        assert_eq!(source.code, RuntimeCode::Cancelled);
        assert_eq!(source.message, "build cancelled");
        assert_eq!(probe.reads.load(Ordering::SeqCst), 0);
        assert_eq!(
            lookups.load(Ordering::SeqCst),
            if initial_miss { 2 } else { 1 }
        );
        assert!(probe.session.state.anchor_flights.is_empty());
    }
}
