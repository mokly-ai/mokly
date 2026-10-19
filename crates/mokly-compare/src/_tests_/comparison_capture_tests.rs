//! Source passes stay grouped even when the source retains no render artifacts.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

use mokly_graph::asset_delivery::AssetReadMock;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResourcesMock};
use mokly_graph::error::GraphError;
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_html::composition::Composed;
use mokly_html::parse;
use mokly_model::axes::ColorScheme;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_model::usage::CatalogueUsage;
use unimock::{Clause, MockFn, Unimock, matching};

use super::{capture, capture_with_bound};

fn source(
    side: &'static str,
    count: usize,
    events: Arc<Mutex<Vec<String>>>,
) -> Arc<dyn RenderGeneration> {
    Arc::new(Unimock::new(source_calls(side, count, events)))
}

fn source_calls(side: &'static str, count: usize, events: Arc<Mutex<Vec<String>>>) -> impl Clause {
    let plans = (0..count)
        .map(|index| {
            let route = format!("{index}/index.html");
            (
                route.clone(),
                DocumentPlan {
                    route,
                    resource_key: "resource".into(),
                    key: key(NodeKind::Document, &[side.as_bytes()]),
                    entry: index,
                    viewport: None,
                    color_scheme: ColorScheme::Light,
                    stylesheets: vec![],
                },
            )
        })
        .collect::<BTreeMap<_, _>>();
    (
        RenderGenerationMock::check_cancelled
            .each_call(matching!())
            .answers(&|_| Ok(())),
        RenderGenerationMock::comparison_capture
            .each_call(matching!())
            .returns(None),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::resource_routes
            .each_call(matching!())
            .returns(vec!["styles/shared.CSS".into(), "assets/image.png".into()]),
        RenderGenerationMock::render_all
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                Ok(RenderSummary {
                    documents: count,
                    ..Default::default()
                })
            })),
        GeneratedResourcesMock::resource
            .each_call(matching!("styles/shared.CSS"))
            .answers(&|_, _| Ok(Some(b"p{color:red}".to_vec()))),
        RenderGenerationMock::resource_digest
            .each_call(matching!("static/mokly-generated/assets/image.png"))
            .answers(&|_, _| Ok(Some("asset digest".into()))),
        RenderGenerationMock::comparison_document
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| {
                events.lock().unwrap().push(side.into());
                Ok(Arc::new(Artifact {
                    bytes: format!("{side}:{route}").into_bytes(),
                    content_type: "text/html".into(),
                    fragment: None,
                    document: Some(Composed {
                        tree: parse::document("<!doctype html><p>saved</p>"),
                        usage: CatalogueUsage::Unavailable,
                        warnings: vec![],
                        resources: vec![],
                        components: vec![],
                        links: vec![],
                    }),
                }))
            })),
        RenderGenerationMock::closure
            .each_call(matching!(_))
            .answers(&|_, route| {
                Ok(Closure {
                    files: BTreeSet::from([route.into()]),
                    ..Default::default()
                })
            }),
    )
}

#[test]
fn captured_assets_forward_streams_and_membership_without_reading_payloads() {
    let source: Arc<dyn RenderGeneration> = Arc::new(Unimock::new((
        source_calls("base", 1, Arc::new(Mutex::new(vec![]))),
        GeneratedResourcesMock::open_asset
            .each_call(matching!("assets/image.png"))
            .answers(&|_, _| {
                Ok(Some(Box::new(Unimock::new(
                    AssetReadMock::length.next_call(matching!()).returns(17_u64),
                ))))
            }),
        GeneratedResourcesMock::contains_resource
            .each_call(matching!("assets/image.png"))
            .answers(&|_, _| Ok(true)),
    )));
    let captured = capture_with_bound(source, usize::MAX).unwrap();
    assert!(captured.comparison_capture().is_some());
    assert!(captured.contains_resource("assets/image.png").unwrap());
    assert_eq!(
        captured
            .open_asset("assets/image.png")
            .unwrap()
            .unwrap()
            .length(),
        17
    );
}

#[test]
fn side_switch_count_is_constant_and_replays_do_not_render() {
    let run = |count| {
        let events = Arc::new(Mutex::new(vec![]));
        let before = capture(source("before", count, events.clone())).unwrap();
        let after = capture(source("after", count, events.clone())).unwrap();
        for _ in 0..3 {
            for index in 0..count {
                let route = format!("{index}/index.html");
                for (label, side) in [("before", &before), ("after", &after)] {
                    assert_eq!(
                        side.comparison_document(&route).unwrap().bytes,
                        format!("{label}:{route}").as_bytes()
                    );
                    assert_eq!(
                        side.render(&route).unwrap().bytes,
                        format!("{label}:{route}").as_bytes()
                    );
                    assert!(side.closure(&route).unwrap().evidence.is_empty());
                    assert_eq!(
                        side.closure(&route).unwrap().files,
                        BTreeSet::from([route.clone()])
                    );
                }
            }
        }
        assert_eq!(before.render_all().unwrap().documents, count);
        for side in [&before, &after] {
            assert_eq!(
                side.resource_digest("static/mokly-generated/assets/image.png")
                    .unwrap(),
                Some("asset digest".into())
            );
            assert_eq!(
                side.resource("styles/shared.CSS").unwrap(),
                Some(b"p{color:red}".to_vec())
            );
            assert_eq!(
                side.resource_bytes("static/mokly-generated/styles/shared.CSS")
                    .unwrap(),
                Some(b"p{color:red}".to_vec())
            );
            assert_eq!(
                side.resource_digest("static/mokly-generated/styles/shared.CSS")
                    .unwrap(),
                Some(mokly_model::material::digest(b"p{color:red}"))
            );
        }
        let events = events.lock().unwrap();
        let switches = 1 + events.windows(2).filter(|pair| pair[0] != pair[1]).count();
        assert_eq!(
            events.iter().filter(|side| *side == "before").count(),
            count
        );
        assert_eq!(events.iter().filter(|side| *side == "after").count(), count);
        (events.len(), switches)
    };
    let small = run(8);
    let large = run(32);
    assert_eq!(small, (16, 2));
    assert_eq!(large, (small.0 * 4, small.1));
}

#[test]
fn smaller_bound_rebuilds_from_original_source_without_stacking_captures() {
    let events = Arc::new(Mutex::new(vec![]));
    let original = source("base", 4, events.clone());
    let full = capture(original.clone()).unwrap();
    let full_info = full.comparison_capture().unwrap();
    assert_eq!(full_info.views, 4);
    let bound = full_info.retained_bytes / 2;
    let smaller = capture_with_bound(full.clone(), bound).unwrap();
    let smaller_info = smaller.comparison_capture().unwrap();
    assert!(!Arc::ptr_eq(&full, &smaller));
    assert!(Arc::ptr_eq(&smaller_info.source, &original));
    assert!(smaller_info.retained_bytes <= bound);
    assert!(smaller_info.views < full_info.views);
    assert_eq!(events.lock().unwrap().len(), 8);
    for index in 0..4 {
        let route = format!("{index}/index.html");
        assert_eq!(
            smaller.comparison_document(&route).unwrap().bytes,
            full.comparison_document(&route).unwrap().bytes
        );
    }
}

#[test]
fn failed_source_validation_stops_capture_and_preserves_the_diagnostic() {
    let source: Arc<dyn RenderGeneration> = Arc::new(Unimock::new((
        RenderGenerationMock::comparison_capture
            .each_call(matching!())
            .returns(None),
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Err(GraphError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Cancelled,
                    message: "cancelled".into(),
                },
            })),
    )));
    assert!(
        matches!(capture(source), Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled)
    );
}
