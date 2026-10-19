//! Cancellation between views stops capture before the next document is encoded.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::error::GraphError;
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_model::axes::ColorScheme;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use unimock::{MockFn, Unimock, matching};

use super::{CapturedGeneration, capture};

#[test]
fn a_retained_capture_forwards_cancellation_to_its_source() {
    let generation = CapturedGeneration {
        source: Arc::new(Unimock::new(
            RenderGenerationMock::check_cancelled
                .next_call(matching!())
                .returns(Err(GraphError::Runtime {
                    source: RuntimeDiagnostic {
                        code: RuntimeCode::Cancelled,
                        message: "source cancelled".into(),
                    },
                })),
        )),
        views: BTreeMap::new(),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
    };
    let GraphError::Runtime { source } = generation.check_cancelled().unwrap_err() else {
        panic!("expected source cancellation")
    };
    assert_eq!(source.code, RuntimeCode::Cancelled);
    assert_eq!(source.message, "source cancelled");
}

#[test]
fn cancellation_between_views_returns_the_error_without_encoding_a_later_view() {
    let rendered = Arc::new(AtomicUsize::new(0));
    let cancelled = Arc::new(AtomicBool::new(false));
    let checks = Arc::new(AtomicUsize::new(0));
    let plans: BTreeMap<_, _> = ["first/index.html", "later/index.html"]
        .into_iter()
        .enumerate()
        .map(|(entry, route)| {
            (
                route.into(),
                DocumentPlan {
                    resource_key: "resources".into(),
                    route: route.into(),
                    key: key(NodeKind::Document, &[route.as_bytes()]),
                    entry,
                    viewport: None,
                    color_scheme: ColorScheme::Light,
                    stylesheets: vec![],
                },
            )
        })
        .collect();
    let cancellation = cancelled.clone();
    let check_count = checks.clone();
    let render_count = rendered.clone();
    let error = {
        let source = Arc::new(Unimock::new((
            RenderGenerationMock::comparison_capture
                .each_call(matching!())
                .returns(None),
            RenderGenerationMock::render_all
                .next_call(matching!())
                .returns(Ok(RenderSummary {
                    documents: 2,
                    ..Default::default()
                })),
            RenderGenerationMock::resource_routes
                .next_call(matching!())
                .returns(vec![]),
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(plans),
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    check_count.fetch_add(1, Ordering::SeqCst);
                    if cancellation.load(Ordering::SeqCst) {
                        Err(GraphError::Runtime {
                            source: RuntimeDiagnostic {
                                code: RuntimeCode::Cancelled,
                                message: "capture cancelled".into(),
                            },
                        })
                    } else {
                        Ok(())
                    }
                })),
            RenderGenerationMock::comparison_document
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    render_count.fetch_add(1, Ordering::SeqCst);
                    Ok(Arc::new(Artifact {
                        bytes: b"captured first view".to_vec(),
                        content_type: "text/html".into(),
                        document: None,
                        fragment: None,
                    }))
                })),
            RenderGenerationMock::closure
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    cancelled.store(true, Ordering::SeqCst);
                    Ok(Closure::default())
                })),
        )));
        capture(source).err()
    };
    let Some(GraphError::Runtime { source }) = error else {
        panic!("expected capture cancellation")
    };
    assert_eq!(source.code, RuntimeCode::Cancelled);
    assert_eq!(source.message, "capture cancelled");
    assert_eq!(rendered.load(Ordering::SeqCst), 1);
    assert_eq!(checks.load(Ordering::SeqCst), 2);
}
