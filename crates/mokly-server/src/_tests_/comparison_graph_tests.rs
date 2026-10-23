//! Public capture rejects changed bytes while using the graph's one digest boundary.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::collection::ComparisonCollectorMock;
use mokly_graph::error::GraphError;
use mokly_graph::types::{
    ComparisonDocument, RenderGeneration, RenderGenerationMock, RenderSummary,
};
use mokly_model::material::digest;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use unimock::{MockFn, Unimock, matching};

use crate::comparison_graph::FrozenResources;

#[test]
fn frozen_resources_preserve_the_generation_cancellation_error() {
    let graph: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new(
        RenderGenerationMock::check_cancelled
            .next_call(matching!())
            .returns(Err(GraphError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Cancelled,
                    message: "cancelled generation".into(),
                },
            })),
    )));
    let GraphError::Runtime { source } = graph.check_cancelled().unwrap_err() else {
        panic!("expected cancellation")
    };
    assert_eq!(source.code, RuntimeCode::Cancelled);
    assert_eq!(source.message, "cancelled generation");
}

#[test]
fn capture_reuse_cannot_bypass_frozen_resource_checks() {
    let graph: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new(())));
    assert!(graph.comparison_capture().is_none());
}

#[test]
fn saved_digests_reject_later_resource_mutation_without_a_second_hash_read() {
    let graph: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new((
        RenderGenerationMock::resource_digest
            .next_call(matching!("static/image.png"))
            .returns(Ok(Some(digest(b"before")))),
        RenderGenerationMock::resource_bytes
            .next_call(matching!("static/image.png"))
            .returns(Ok(Some(b"before".to_vec()))),
        RenderGenerationMock::resource_bytes
            .next_call(matching!("static/image.png"))
            .returns(Ok(Some(b"after".to_vec()))),
    ))));
    assert_eq!(
        graph.resource_digest("static/image.png").unwrap(),
        Some(digest(b"before"))
    );
    assert_eq!(
        graph.resource_bytes("static/image.png").unwrap(),
        Some(b"before".to_vec())
    );
    assert!(graph.resource_bytes("static/image.png").is_err());
    assert_eq!(
        graph.resource_digest("static/image.png").unwrap(),
        Some(digest(b"before"))
    );
}

#[test]
fn a_resource_absent_during_classification_cannot_appear_in_that_capture() {
    let graph: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new((
        RenderGenerationMock::resource_bytes
            .next_call(matching!("static/new.png"))
            .returns(Ok(None)),
        RenderGenerationMock::resource_bytes
            .next_call(matching!("static/new.png"))
            .returns(Ok(Some(b"new".to_vec()))),
    ))));
    assert!(graph.resource_bytes("static/new.png").unwrap().is_none());
    assert!(graph.resource_bytes("static/new.png").is_err());
}

#[test]
fn an_evicted_document_must_reproduce_the_accepted_document_bytes() {
    let artifact = |bytes: &[u8]| {
        Arc::new(Artifact {
            bytes: bytes.into(),
            document: None,
            fragment: None,
            content_type: "text/html".into(),
        })
    };
    let graph: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new((
        RenderGenerationMock::comparison_document
            .next_call(matching!("sample/index.mobile.html"))
            .returns(Ok(artifact(b"<p>classified</p>"))),
        RenderGenerationMock::render
            .next_call(matching!("sample/index.mobile.html"))
            .returns(Ok(artifact(b"<p>changed after eviction</p>"))),
    ))));
    graph
        .comparison_document("sample/index.mobile.html")
        .unwrap();
    assert!(graph.render("sample/index.mobile.html").is_err());
}

#[test]
fn closure_capture_freezes_ignored_resources_without_an_extra_catalogue_pass() {
    let graph: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new((
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Ok(RenderSummary {
                documents: 1,
                ..Default::default()
            })),
        RenderGenerationMock::closure
            .each_call(matching!("sample/index.mobile.html"))
            .answers(&|_, _| {
                Ok(Closure {
                    edges: BTreeMap::from([("static/ignored.png".into(), Vec::new())]),
                    ..Default::default()
                })
            })
            .n_times(2),
        RenderGenerationMock::resource_digest
            .next_call(matching!("static/ignored.png"))
            .returns(Ok(Some(digest(b"classified")))),
        RenderGenerationMock::resource_bytes
            .next_call(matching!("static/ignored.png"))
            .returns(Ok(Some(b"mutated".to_vec()))),
    ))));
    assert_eq!(graph.render_all().unwrap().documents, 1);
    for _ in 0..2 {
        assert_eq!(
            graph
                .closure("sample/index.mobile.html")
                .unwrap()
                .edges
                .len(),
            1
        );
    }
    assert!(graph.resource_bytes("static/ignored.png").is_err());
}

#[test]
fn validated_collection_preserves_frozen_document_and_resource_checks() {
    let graph = FrozenResources::new(Arc::new(Unimock::new((
        RenderGenerationMock::collect_comparison
            .each_call(matching!(_))
            .answers(&|_, collector| {
                let summary = RenderSummary {
                    documents: 1,
                    ..Default::default()
                };
                collector.summary(&summary);
                collector.collect(
                    "sample/index.html",
                    ComparisonDocument {
                        artifact: Arc::new(Artifact {
                            bytes: b"before".to_vec(),
                            content_type: "text/html".into(),
                            document: None,
                            fragment: None,
                        }),
                        closure: Closure {
                            edges: BTreeMap::from([("static/image.png".into(), vec![])]),
                            ..Default::default()
                        },
                    },
                )?;
                Ok(summary)
            }),
        RenderGenerationMock::resource_digest
            .next_call(matching!("static/image.png"))
            .returns(Ok(Some(digest(b"image")))),
        RenderGenerationMock::resource_bytes
            .next_call(matching!("static/image.png"))
            .returns(Ok(Some(b"changed".to_vec()))),
        RenderGenerationMock::render
            .next_call(matching!("sample/index.html"))
            .returns(Ok(Arc::new(Artifact {
                bytes: b"changed".to_vec(),
                content_type: "text/html".into(),
                document: None,
                fragment: None,
            }))),
    ))));
    let mut collector = Unimock::new((
        ComparisonCollectorMock::summary.next_call(matching!((summary) if summary.documents == 1)).returns(()),
        ComparisonCollectorMock::collect.next_call(matching!((route, input) if *route == "sample/index.html" && input.artifact.bytes == b"before")).returns(Ok(())),
    ));
    assert_eq!(
        graph.collect_comparison(&mut collector).unwrap().documents,
        1
    );
    assert!(graph.resource_bytes("static/image.png").is_err());
    assert!(graph.render("sample/index.html").is_err());
}
