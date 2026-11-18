//! Complete validation seeds compact facts without merging diagnostic contexts.

use std::collections::BTreeMap;
use std::sync::atomic::Ordering;

use crate::error::GraphError;
use crate::link_results;
use crate::types::RenderGeneration;
use crate::validation;
use crate::workers::ValidatedView;

use super::validation_cache_tests::reference;
use super::validation_sharing_tests::sharing;

pub(super) fn views(missing: bool) -> BTreeMap<String, ValidatedView> {
    ["desktop.dark", "desktop", "mobile.dark", "mobile"]
        .into_iter()
        .map(|axes| {
            let route = format!("target/index.{axes}.html");
            (
                route.clone(),
                ValidatedView {
                    route,
                    anchors: if missing && axes == "mobile.dark" {
                        Default::default()
                    } else {
                        ["summary".into()].into()
                    },
                    links: vec![reference("target", "summary")],
                    closure: Default::default(),
                    warnings: Vec::new(),
                },
            )
        })
        .collect()
}

#[test]
fn completed_validation_seeds_later_checked_reads_without_target_restores() {
    let probe = sharing(false, false, link_results::LIMIT);
    validation::completed(&probe.session, &views(false)).unwrap();
    validation::links(&probe.session, &[reference("journey", "summary")]).unwrap();
    probe
        .session
        .comparison_document("target/index.desktop.html")
        .unwrap();
    assert_eq!(probe.reads.load(Ordering::SeqCst), 1);
    assert_eq!(probe.session.state.link_results.len(), 4);
}

#[test]
fn completed_negative_uses_the_view_route_and_later_reads_use_the_current_caller() {
    let probe = sharing(false, true, link_results::LIMIT);
    probe
        .session
        .comparison_document("target/index.desktop.html")
        .unwrap();
    probe.reads.store(0, Ordering::SeqCst);
    validation::completed(&probe.session, &views(false)).unwrap();
    let error = validation::completed(&probe.session, &views(true)).unwrap_err();
    let GraphError::Invalid { route, message, .. } = error else {
        panic!("expected complete validation failure")
    };
    assert_eq!(route, "target/index.desktop.dark.html");
    assert_eq!(
        message,
        "target/index.desktop.dark.html: logical fragment \"summary\" is missing from target/index.mobile.dark.html"
    );
    let mut request = reference("target", "summary");
    request.source_route = "later/index.html".into();
    let error = validation::links(&probe.session, &[request]).unwrap_err();
    let GraphError::Invalid { route, message, .. } = error else {
        panic!("expected cached target failure")
    };
    assert_eq!(route, "later/index.html");
    assert_eq!(
        message,
        "later/index.html: logical fragment \"summary\" is missing from target/index.mobile.dark.html"
    );
    assert_eq!(probe.reads.load(Ordering::SeqCst), 0);
}
