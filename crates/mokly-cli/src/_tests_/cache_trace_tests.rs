//! Each cache phase closes with one render cache count record before its end record.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use mokly_graph::cache::{CacheStats, RenderCacheMock};
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use super::serve_trace_tests::capture_cache;

fn stats(hits: usize, misses: usize, evictions: usize, bytes: usize, entries: usize) -> CacheStats {
    CacheStats {
        bytes,
        entries,
        hits,
        misses,
        evictions,
    }
}

type Reads = Arc<Mutex<VecDeque<CacheStats>>>;

/// Answer each statistics read in order. The queue is empty once every read happened.
/// Tests keep the original mock and give the timing layer a clone, because the tracing
/// dispatcher can release the layer on another thread, and unimock verifies the original.
fn scripted(reads: Vec<CacheStats>) -> (Unimock, Reads) {
    let queue = Arc::new(Mutex::new(VecDeque::from(reads)));
    let answers = queue.clone();
    let cache = Unimock::new(
        RenderCacheMock::stats
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                answers.lock().unwrap().pop_front().unwrap()
            })),
    );
    (cache, queue)
}

fn cache_records(records: &[Value]) -> Vec<&Value> {
    records
        .iter()
        .filter(|record| record["stage"] == "render.cache")
        .collect()
}

fn end_index(records: &[Value], stage: &str) -> usize {
    records
        .iter()
        .position(|record| record["stage"] == stage && record["event"] == "end")
        .unwrap()
}

#[test]
fn each_phase_reports_the_differences_and_the_end_totals_before_its_end() {
    let phases = [
        "serve.background",
        "changes.classify",
        "review.capture-side",
        "review.compare-views",
        "output.write",
    ];
    let mut reads = Vec::new();
    for index in 0..phases.len() {
        reads.push(stats(5 + index, 2, 1, 10, 1));
        reads.push(stats(9 + 2 * index, 5, 3 + index, 300 + index, 4));
    }
    let (cache, queue) = scripted(reads);
    let records = capture_cache(Arc::new(cache.clone()), || {
        tracing::info_span!("serve.background", status = "ok").in_scope(|| {});
        tracing::info_span!("changes.classify", status = "error").in_scope(|| {});
        tracing::info_span!("review.capture-side", side = "base").in_scope(|| {});
        tracing::info_span!("review.compare-views", status = "error").in_scope(|| {});
        tracing::info_span!("output.write").in_scope(|| {});
    });
    assert!(queue.lock().unwrap().is_empty());
    let counts = cache_records(&records);
    assert_eq!(counts.len(), phases.len());
    for (index, (phase, record)) in phases.iter().zip(counts).enumerate() {
        let start = records
            .iter()
            .find(|record| record["stage"] == *phase && record["event"] == "start")
            .unwrap();
        assert_eq!(record["event"], "counts");
        assert_eq!(record["role"], "core");
        assert_eq!(record["session"], "test");
        assert_eq!(record["phase"], *phase);
        assert_eq!(record["parentId"], start["id"]);
        assert_ne!(record["id"], start["id"]);
        assert_eq!(record["hits"], 4 + index);
        assert_eq!(record["misses"], 3);
        assert_eq!(record["evictions"], 2 + index);
        assert_eq!(record["chargedBytes"], 300 + index);
        assert_eq!(record["entries"], 4);
        let end = end_index(&records, phase);
        assert_eq!(&records[end - 1], record);
    }
}

#[test]
fn other_stages_read_no_cache_statistics_and_emit_no_cache_records() {
    let cache = Unimock::new(());
    let records = capture_cache(Arc::new(cache.clone()), || {
        tracing::info_span!("serve.ready", status = "error").in_scope(|| {
            tracing::info_span!("review.base-tree").in_scope(|| {});
            tracing::info_span!("render.document", cache_hit = true).in_scope(|| {});
            tracing::info_span!("watch.action", action = "rebuild").in_scope(|| {});
        });
    });
    assert_eq!(records.len(), 8);
    assert!(cache_records(&records).is_empty());
}

#[test]
fn a_failed_phase_still_reports_its_cache_counts() {
    let (cache, queue) = scripted(vec![stats(0, 0, 0, 0, 0), stats(1, 7, 6, 256, 2)]);
    let records = capture_cache(Arc::new(cache.clone()), || {
        let span = tracing::info_span!(
            "review.compare-views",
            status = "error",
            views = tracing::field::Empty
        );
        let _scope = span.enter();
    });
    assert!(queue.lock().unwrap().is_empty());
    assert_eq!(records.len(), 3);
    assert_eq!(records[1]["stage"], "render.cache");
    assert_eq!(records[1]["misses"], 7);
    assert_eq!(records[1]["evictions"], 6);
    assert_eq!(records[2]["event"], "end");
    assert_eq!(records[2]["status"], "error");
    assert!(records[2].get("misses").is_none());
}

#[test]
fn nested_phases_report_their_own_interval_and_the_parent_includes_it() {
    let (cache, queue) = scripted(vec![
        stats(1, 1, 0, 50, 1),
        stats(3, 2, 0, 60, 2),
        stats(10, 4, 1, 90, 3),
        stats(12, 9, 2, 120, 4),
    ]);
    let records = capture_cache(Arc::new(cache.clone()), || {
        tracing::info_span!("output.write").in_scope(|| {
            tracing::info_span!("review.capture-side", side = "head").in_scope(|| {});
        });
    });
    assert!(queue.lock().unwrap().is_empty());
    let counts = cache_records(&records);
    assert_eq!(counts.len(), 2);
    assert_eq!(counts[0]["phase"], "review.capture-side");
    assert_eq!(counts[0]["parentId"], records[1]["id"]);
    assert_eq!(counts[0]["hits"], 7);
    assert_eq!(counts[0]["misses"], 2);
    assert_eq!(counts[0]["evictions"], 1);
    assert_eq!(counts[0]["chargedBytes"], 90);
    assert_eq!(counts[1]["phase"], "output.write");
    assert_eq!(counts[1]["parentId"], records[0]["id"]);
    assert_eq!(counts[1]["hits"], 11);
    assert_eq!(counts[1]["misses"], 8);
    assert_eq!(counts[1]["evictions"], 2);
    assert_eq!(counts[1]["chargedBytes"], 120);
    assert_eq!(counts[1]["entries"], 4);
    assert!(end_index(&records, "review.capture-side") < end_index(&records, "output.write"));
}

#[test]
fn background_counts_keep_their_document_hits_beside_the_cache_record() {
    let (cache, queue) = scripted(vec![stats(0, 0, 0, 0, 0), stats(3, 1, 0, 40, 2)]);
    let records = capture_cache(Arc::new(cache.clone()), || {
        tracing::info_span!("serve.background", status = "ok").in_scope(|| {
            tracing::info_span!("render.document", cache_hit = true).in_scope(|| {});
        });
    });
    assert!(queue.lock().unwrap().is_empty());
    let background: Vec<_> = records
        .iter()
        .filter(|record| record["stage"] == "serve.background" && record["event"] == "counts")
        .collect();
    assert_eq!(background.len(), 1);
    assert_eq!(background[0]["documents"], 1);
    assert_eq!(background[0]["cacheHits"], 1);
    assert!(background[0].get("hits").is_none());
    let counts = cache_records(&records);
    assert_eq!(counts.len(), 1);
    assert_eq!(counts[0]["hits"], 3);
    assert!(counts[0].get("cacheHits").is_none());
}
