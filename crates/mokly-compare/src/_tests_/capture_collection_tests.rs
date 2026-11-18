//! Growing summary charges evict later candidates without exceeding capture capacity.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::types::{ComparisonDocument, RenderSummary};

use super::Collector;

fn input() -> ComparisonDocument {
    input_bytes(b"<!doctype html><p>exact bytes</p>".to_vec())
}

fn input_bytes(bytes: Vec<u8>) -> ComparisonDocument {
    ComparisonDocument {
        artifact: Arc::new(Artifact {
            bytes,
            content_type: "text/html".into(),
            fragment: None,
            document: None,
        }),
        closure: Closure::default(),
    }
}

fn deterministic_bytes(length: usize, mut state: u32) -> Vec<u8> {
    (0..length)
        .map(|_| {
            state ^= state << 13;
            state ^= state >> 17;
            state ^= state << 5;
            state as u8
        })
        .collect()
}

#[test]
fn candidate_charges_are_exact_and_summary_growth_keeps_earlier_routes() {
    let summary = RenderSummary::default();
    let mut full = Collector::new(usize::MAX);
    full.summary(&summary);
    full.collect("a/index.html", input()).unwrap();
    let cost = full.views["a/index.html"].charge("a/index.html");
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
    let cost = collector.views["a/index.html"].charge("a/index.html");
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

#[test]
fn oversized_arrival_is_skipped_and_later_fitting_routes_are_kept() {
    // This pins the capture rule of docs/protocol/mokly-comparison-serving.md.
    let summary = RenderSummary::default();
    let small_bytes = deterministic_bytes(1_000, 0x1234_5678);
    let large_bytes = deterministic_bytes(8_000, 0x9abc_def0);
    let mut full = Collector::new(usize::MAX);
    full.summary(&summary);
    full.collect("a/index.html", input_bytes(small_bytes.clone()))
        .unwrap();
    let small = full.views["a/index.html"].charge("a/index.html");
    full.collect("b/index.html", input_bytes(large_bytes.clone()))
        .unwrap();
    let big = full.views["b/index.html"].charge("b/index.html");

    let mut collector = Collector::new(full.fixed + small + big - 1);
    collector.summary(&summary);
    collector
        .collect("a/index.html", input_bytes(small_bytes))
        .unwrap();
    collector
        .collect("b/index.html", input_bytes(large_bytes))
        .unwrap();
    collector
        .collect(
            "c/index.html",
            input_bytes(deterministic_bytes(1_000, 0x2468_ace0)),
        )
        .unwrap();

    assert_eq!(
        collector
            .views
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        ["a/index.html", "c/index.html"]
    );
}
