//! Shared encoding produces review spans only when the comparison capture calls it.

use std::sync::Arc;

use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::Comparison;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::cache::{Artifact, MemoryCache, RenderCache};
use mokly_graph::closure::Closure;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{ComparisonDocument, RenderGenerationMock, RenderSummary};
use mokly_html::composition::Composed;
use mokly_html::tree::Node;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use super::serve_trace_tests::capture;

#[test]
fn cache_compaction_has_no_review_span_but_capture_encoding_keeps_its_span() {
    let value = Arc::new(Artifact {
        bytes: b"document".repeat(1024),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: vec![Node::Text("tree".into())],
            usage: CatalogueUsage::Unavailable,
            warnings: vec![],
            resources: vec![],
            components: vec![],
            links: vec![],
        }),
    });
    let full = value.byte_cost() + 260;
    let retained = full * 45 + 1024;
    let cache = MemoryCache::new(retained + retained / 15, 1024);
    let records = capture(|| {
        for index in 0..46 {
            cache.insert(
                NodeKey(format!("{index:02}").as_str().into()),
                value.clone(),
            );
        }
        assert_eq!(cache.stats().entries, 46);
        assert_eq!(cache.get(&NodeKey("00".into())).unwrap().bytes, value.bytes);
        assert_eq!(cache.stats().restores, 1);
        let source = Arc::new(Unimock::new((
            RenderGenerationMock::comparison_capture
                .next_call(matching!())
                .returns(None),
            RenderGenerationMock::collect_comparison
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, collector| {
                    collector.collect(
                        "a/index.html",
                        ComparisonDocument {
                            artifact: value.clone(),
                            closure: Closure::default(),
                        },
                    )?;
                    Ok(RenderSummary {
                        documents: 1,
                        ..Default::default()
                    })
                })),
            RenderGenerationMock::resource_routes
                .next_call(matching!())
                .returns(vec![]),
        )));
        let engine: &dyn Comparison = &Engine {
            moves: Arc::new(Unimock::new(())),
            css: Arc::new(MemoryParsedCss::new(1024)),
        };
        assert_eq!(
            engine
                .capture_head(source)
                .unwrap()
                .comparison_capture()
                .unwrap()
                .views,
            1
        );
    });
    let encodes: Vec<_> = records
        .iter()
        .filter(|record| record["stage"] == "review.capture-encode")
        .collect();
    assert_eq!(encodes.len(), 2);
    assert_eq!(encodes[0]["event"], "start");
    assert_eq!(encodes[1]["event"], "end");
    assert_eq!(encodes[1]["status"], "ok");
    let validation = records
        .iter()
        .find(|record| record["stage"] == "review.capture-validate" && record["event"] == "start")
        .unwrap();
    assert_eq!(encodes[0]["parentId"], validation["id"]);
}
