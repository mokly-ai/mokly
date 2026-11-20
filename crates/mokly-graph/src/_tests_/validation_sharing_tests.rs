//! Generation sharing keeps checks and diagnostics while avoiding repeated target reads.

use std::sync::atomic::Ordering;

use mokly_html::diagnostic_code::Code;

use crate::error::GraphError;
use crate::link_results;
use crate::types::RenderGeneration;
use crate::validation;

use super::validation_cache_tests::{Probe, configured_probe, reference};

pub(super) fn sharing(retain: bool, missing: bool, bound: usize) -> Probe {
    configured_probe(retain, missing, bound)
}

#[test]
fn shared_pairs_check_all_views_once_even_without_artifact_retention() {
    let probe = sharing(false, false, link_results::LIMIT);
    for target in ["target", "journey", "target"] {
        validation::links(&probe.session, &[reference(target, "summary")]).unwrap();
    }
    assert_eq!(probe.compositions.load(Ordering::SeqCst), 4);
    assert_eq!(probe.reads.load(Ordering::SeqCst), 4);
    assert_eq!(probe.session.state.link_results.len(), 4);
    assert!(probe.session.state.anchor_flights.is_empty());
}

#[test]
fn cached_negative_keeps_each_callers_first_reference_and_exact_error() {
    let probe = sharing(false, false, link_results::LIMIT);
    probe
        .session
        .comparison_document("target/index.desktop.html")
        .unwrap();
    probe.reads.store(0, Ordering::SeqCst);
    probe.compositions.store(0, Ordering::SeqCst);
    for caller in ["first/index.html", "second/index.html"] {
        let mut absent = reference("target", "absent");
        absent.source_route = caller.into();
        let error = validation::links(
            &probe.session,
            &[absent, reference("missing-target", "later")],
        )
        .unwrap_err();
        let GraphError::Invalid {
            code,
            route,
            message,
        } = error
        else {
            panic!("expected absent anchor")
        };
        assert_eq!(code, Code::BuildInvalid);
        assert_eq!(route, caller);
        assert_eq!(
            message,
            format!(
                "{caller}: logical fragment \"absent\" is missing from target/index.desktop.dark.html"
            )
        );
    }
    assert_eq!(probe.compositions.load(Ordering::SeqCst), 1);
    assert_eq!(probe.reads.load(Ordering::SeqCst), 1);
    assert!(probe.session.state.anchor_flights.is_empty());
}

#[test]
fn unknown_target_keeps_its_original_route_without_a_record() {
    let probe = sharing(false, false, link_results::LIMIT);
    probe
        .session
        .comparison_document("target/index.desktop.html")
        .unwrap();
    probe.reads.store(0, Ordering::SeqCst);
    let error = validation::links(&probe.session, &[reference("unknown", "summary")]).unwrap_err();
    let GraphError::Invalid {
        code,
        route,
        message,
    } = error
    else {
        panic!("expected unknown destination")
    };
    assert_eq!(code, Code::BuildInvalid);
    assert_eq!(route, "unknown");
    assert_eq!(message, "unknown logical destination");
    assert_eq!(probe.reads.load(Ordering::SeqCst), 0);
    assert_eq!(probe.session.state.link_results.len(), 0);
}

#[test]
fn a_new_generation_rechecks_a_target_that_lost_its_anchor() {
    let first = sharing(false, false, link_results::LIMIT);
    validation::links(&first.session, &[reference("target", "summary")]).unwrap();
    let second = sharing(false, true, link_results::LIMIT);
    let error = validation::links(&second.session, &[reference("target", "summary")]).unwrap_err();
    let GraphError::Invalid { route, message, .. } = error else {
        panic!("expected changed target")
    };
    assert_eq!(route, "caller/index.desktop.html");
    assert_eq!(
        message,
        "caller/index.desktop.html: logical fragment \"summary\" is missing from target/index.mobile.dark.html"
    );
    assert_eq!(second.compositions.load(Ordering::SeqCst), 3);
    assert!(second.session.state.anchor_flights.is_empty());
}

#[test]
fn a_full_pair_store_preserves_validation_on_each_miss() {
    let probe = sharing(false, false, 128);
    validation::links(&probe.session, &[reference("target", "summary")]).unwrap();
    let first = probe.reads.load(Ordering::SeqCst);
    validation::links(&probe.session, &[reference("target", "summary")]).unwrap();
    assert!(probe.session.state.link_results.retained_bytes() <= 128);
    assert!(probe.session.state.link_results.len() > 0);
    assert!(probe.session.state.link_results.len() < 4);
    assert!(probe.reads.load(Ordering::SeqCst) > first);
    assert!(probe.reads.load(Ordering::SeqCst) < first * 2);
    let error = validation::links(&probe.session, &[reference("target", "absent")]).unwrap_err();
    let GraphError::Invalid { message, .. } = error else {
        panic!("expected ordinary overflow check")
    };
    assert_eq!(
        message,
        "caller/index.desktop.html: logical fragment \"absent\" is missing from target/index.desktop.dark.html"
    );
}
