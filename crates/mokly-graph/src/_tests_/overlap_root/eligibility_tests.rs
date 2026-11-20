//! Budget refusal, template composition, and failed roots retain original dispatch.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::template_types::Template;
use mokly_html::error::HtmlError;
use mokly_html::fragment::{Fragment, FragmentRendererMock};
use mokly_model::runtime_diagnostic::RuntimeCode;
use unimock::{MockFn, Unimock, matching};

use crate::cache::MemoryCache;
use crate::error::GraphError;
use crate::types::RenderGeneration;
use crate::workers::RenderWorkersMock;

use super::support::{catalogue, completion, document, refusing, route, session};

#[test]
fn budget_refusal_completes_the_successful_root_without_handoff_or_repeat() {
    let calls = Arc::new(AtomicUsize::new(0));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, _| {
                    calls.fetch_add(1, Ordering::SeqCst);
                    Ok(Fragment {
                        html: document("<p>Once</p>"),
                        ..Default::default()
                    })
                }
            })),
    );
    let (session, _) = session(
        catalogue(),
        Arc::new(provider.clone()),
        Arc::new(MemoryCache::new(0, 0)),
    );
    let (completion, counts) = refusing();
    let result = session
        .render_background(&route("caller"), Arc::new(completion.clone()))
        .unwrap();
    assert!(
        String::from_utf8(result.bytes.clone())
            .unwrap()
            .contains("<p>Once</p>")
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(counts.entered.load(Ordering::SeqCst), 1);
    assert_eq!(counts.handed.load(Ordering::SeqCst), 0);
}

#[test]
fn template_composition_keeps_ordinary_ownership_and_never_signals_a_root_handoff() {
    let mut catalogue = catalogue();
    let source = document("<p>Template</p>");
    catalogue.templates.insert(
        "caller".into(),
        Template {
            source_path: "caller.page.html".into(),
            source: source.clone(),
            body: source,
            body_offset: 0,
            page: true,
        },
    );
    let (session, _) = session(
        catalogue,
        Arc::new(Unimock::new(())),
        Arc::new(MemoryCache::new(1 << 20, 0)),
    );
    let (completion, counts) = completion();
    let result = session
        .render_background(&route("caller"), Arc::new(completion.clone()))
        .unwrap();
    assert!(
        String::from_utf8(result.bytes.clone())
            .unwrap()
            .contains("<p>Template</p>")
    );
    assert_eq!(counts.metadata.load(Ordering::SeqCst), 0);
    assert_eq!(counts.handed.load(Ordering::SeqCst), 0);
}

#[test]
fn failed_root_keeps_its_single_attempt_and_never_admits_successful_completion() {
    let calls = Arc::new(AtomicUsize::new(0));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, request| {
                    calls.fetch_add(1, Ordering::SeqCst);
                    Err(HtmlError::FragmentUnavailable {
                        handle: request.handle.clone(),
                    })
                }
            })),
    );
    let (session, flights) = session(
        catalogue(),
        Arc::new(provider.clone()),
        Arc::new(MemoryCache::new(0, 0)),
    );
    let (completion, counts) = completion();
    let result = session.render_background(&route("caller"), Arc::new(completion.clone()));
    let GraphError::Document { entry, source } = result.unwrap_err() else {
        panic!("expected original document failure")
    };
    assert_eq!(entry, "caller");
    let GraphError::Html {
        source: HtmlError::Route {
            route: failed_route,
            source,
        },
    } = *source
    else {
        panic!("expected original route failure")
    };
    assert_eq!(failed_route, route("caller"));
    let HtmlError::Attempt { source, warnings } = *source else {
        panic!("expected original composition attempt")
    };
    assert_eq!(warnings, vec![]);
    assert!(
        matches!(*source, HtmlError::FragmentUnavailable { ref handle } if handle == "caller.mockup.tsx#default")
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(flights.len(), 0);
    assert_eq!(counts.entered.load(Ordering::SeqCst), 0);
    assert_eq!(counts.handed.load(Ordering::SeqCst), 0);
    assert_eq!(counts.metadata.load(Ordering::SeqCst), 0);
}

#[test]
fn spare_root_payload_capacity_refuses_overlap_but_keeps_the_original_result() {
    let mut html = String::with_capacity(65536);
    html.push_str(&document("<p>Spare capacity</p>"));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .some_call(matching!(_))
            .returns(Ok(Fragment {
                html,
                ..Default::default()
            })),
    );
    let (session, _) = session(
        catalogue(),
        Arc::new(provider.clone()),
        Arc::new(MemoryCache::new(65536, 0)),
    );
    let (completion, counts) = refusing();
    let result = session
        .render_background(&route("caller"), Arc::new(completion.clone()))
        .unwrap();
    assert!(
        String::from_utf8(result.bytes.clone())
            .unwrap()
            .contains("<p>Spare capacity</p>")
    );
    assert_eq!(counts.entered.load(Ordering::SeqCst), 1);
    assert_eq!(counts.handed.load(Ordering::SeqCst), 0);
    assert!(counts.bytes.load(Ordering::SeqCst) >= 65536);
}

#[test]
fn direct_background_dispatch_keeps_the_worker_cancellation_check() {
    let cancelled = Unimock::new(
        RenderWorkersMock::cancelled
            .some_call(matching!())
            .returns(true),
    );
    let calls = Arc::new(AtomicUsize::new(0));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, _| {
                    calls.fetch_add(1, Ordering::SeqCst);
                    Ok(Fragment {
                        html: document("<p>Unexpected work</p>"),
                        ..Default::default()
                    })
                }
            })),
    )
    .no_verify_in_drop();
    let (mut session, _) = session(
        catalogue(),
        Arc::new(provider.clone()),
        Arc::new(MemoryCache::new(0, 0)),
    );
    Arc::get_mut(&mut session.state).unwrap().workers = Arc::new(cancelled.clone());
    let (completion, counts) = completion();
    let result = session.render_background(&route("caller"), Arc::new(completion.clone()));
    assert!(matches!(&result, Err(GraphError::Runtime { .. })));
    let error = result.unwrap_err();
    let GraphError::Runtime { source } = error else {
        panic!("expected cancellation before a root starts")
    };
    assert_eq!(source.code, RuntimeCode::Cancelled);
    assert_eq!(source.message, "build cancelled");
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(counts.entered.load(Ordering::SeqCst), 0);
    assert_eq!(counts.handed.load(Ordering::SeqCst), 0);
}
