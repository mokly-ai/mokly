//! Source passes stay grouped even when the source retains no render artifacts.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

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
use unimock::{MockFn, Unimock, matching};

use super::capture;

fn source(
    side: &'static str,
    count: usize,
    events: Arc<Mutex<Vec<String>>>,
) -> Arc<dyn RenderGeneration> {
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
    Arc::new(Unimock::new((
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::resource_routes
            .each_call(matching!())
            .returns(vec!["styles/shared.CSS".into(), "assets/image.png".into()]),
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Ok(RenderSummary {
                documents: count,
                ..Default::default()
            })),
        GeneratedResourcesMock::resource
            .next_call(matching!("styles/shared.CSS"))
            .returns(Ok(Some(b"p{color:red}".to_vec()))),
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
    )))
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
fn failed_source_validation_stops_capture_and_preserves_the_diagnostic() {
    let source: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Err(GraphError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Cancelled,
                    message: "cancelled".into(),
                },
            })),
    ));
    assert!(
        matches!(capture(source), Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled)
    );
}
