//! Growing summary charges evict later candidates without exceeding capture capacity.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::types::{ComparisonDocument, RenderSummary};

use super::{Collector, charge};

fn input() -> ComparisonDocument {
    ComparisonDocument {
        artifact: Arc::new(Artifact {
            bytes: b"<!doctype html><p>exact bytes</p>".to_vec(),
            content_type: "text/html".into(),
            fragment: None,
            document: None,
        }),
        closure: Closure::default(),
    }
}

#[test]
fn candidate_charges_are_exact_and_summary_growth_keeps_earlier_routes() {
    let summary = RenderSummary::default();
    let mut full = Collector::new(usize::MAX);
    full.summary(&summary);
    full.collect("a/index.html", input()).unwrap();
    let cost = charge("a/index.html", &full.views["a/index.html"]);
    let mut collector = Collector::new(full.fixed + 3 * cost);
    collector.summary(&summary);
    for route in ["a/index.html", "b/index.html", "c/index.html"] {
        collector.collect(route, input()).unwrap();
        assert!(collector.fixed + collector.retained <= collector.bound);
    }
    assert_eq!(collector.retained, 3 * cost);
    collector.summary(&RenderSummary {
        closure: BTreeSet::from(["x".repeat(cost)]),
        ..Default::default()
    });
    assert!(collector.fixed + collector.retained <= collector.bound);
    assert_eq!(
        collector
            .views
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        ["a/index.html"]
    );
    assert_eq!(collector.retained, cost);
    assert_eq!(
        collector.views["a/index.html"]
            .document
            .restore()
            .unwrap()
            .bytes,
        input().artifact.bytes
    );
}

#[test]
fn resources_reclaim_later_candidates_and_oversized_summaries_keep_no_capture() {
    let mut collector = Collector::new(10_000);
    collector.summary(&RenderSummary::default());
    for route in ["a/index.html", "b/index.html", "c/index.html"] {
        collector.collect(route, input()).unwrap();
    }
    let cost = charge("a/index.html", &collector.views["a/index.html"]);
    collector.trim(cost);
    assert_eq!(collector.retained, cost);
    assert_eq!(
        collector
            .views
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        ["a/index.html"]
    );
    collector.summary(&RenderSummary {
        closure: BTreeSet::from(["x".repeat(10_000)]),
        ..Default::default()
    });
    assert_eq!(collector.retained, 0);
    collector.collect("d/index.html", input()).unwrap();
    assert!(collector.views.is_empty());
}
