//! Transient destination failures are retried and successful facts remain generation local.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::composition::{Composed, ComposerMock};
use mokly_html::error::HtmlError;
use mokly_html::parse;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::error::GraphError;
use crate::link_results;
use crate::validation;

use super::validation_cache_tests::reference;
use super::validation_sharing_tests::sharing;

#[test]
fn a_transient_target_error_is_not_retained_as_an_anchor_result() {
    let mut probe = sharing(false, false, link_results::LIMIT);
    validation::links(&probe.session, &[reference("target", "summary")]).unwrap();
    let attempts = Arc::new(AtomicUsize::new(0));
    let calls = attempts.clone();
    Arc::get_mut(&mut probe.session.state).unwrap().composer = Arc::new(Unimock::new(
        ComposerMock::compose
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                if calls.fetch_add(1, Ordering::SeqCst) == 0 {
                    return Err(HtmlError::FragmentUnavailable {
                        handle: "retry".into(),
                    });
                }
                Ok(Composed {
                    tree: parse::html(DeliveredHtml::document("<h1 id=retry>Target</h1>")),
                    usage: CatalogueUsage::Unavailable,
                    warnings: vec![],
                    resources: vec![],
                    components: vec![],
                    links: vec![],
                })
            })),
    ));
    let error = validation::links(&probe.session, &[reference("target", "retry")]).unwrap_err();
    let GraphError::Document { entry, source } = error else {
        panic!("expected target failure")
    };
    assert_eq!(entry, "target");
    let GraphError::Html {
        source: HtmlError::Route { route, source },
    } = *source
    else {
        panic!("expected target route")
    };
    assert_eq!(route, "target/index.desktop.dark.html");
    let HtmlError::FragmentUnavailable { handle } = *source else {
        panic!("expected transient error")
    };
    assert_eq!(handle, "retry");
    validation::links(&probe.session, &[reference("target", "retry")]).unwrap();
    validation::links(&probe.session, &[reference("journey", "retry")]).unwrap();
    assert_eq!(attempts.load(Ordering::SeqCst), 5);
    assert_eq!(probe.session.state.link_results.len(), 8);
    assert!(probe.session.state.anchor_flights.is_empty());
}
