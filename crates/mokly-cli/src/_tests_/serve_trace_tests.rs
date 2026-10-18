//! Timing records use a mocked clock and terminal and never expose authored fields.

use std::sync::atomic::AtomicU64;
use std::sync::{Arc, Mutex};

use mokly_sidecar::workers::{Clock, ClockMock};
use serde_json::Value;
use tracing_subscriber::layer::SubscriberExt;
use unimock::{MockFn, Unimock, matching};

use crate::terminal::TerminalMock;

use super::Timings;

pub(super) fn capture(run: impl FnOnce()) -> Vec<Value> {
    collect_lines(
        run,
        Arc::new(Unimock::new(
            ClockMock::now_ms.each_call(matching!()).returns(0u64),
        )),
    )
    .iter()
    .map(|line| serde_json::from_str(line.strip_prefix("[mokly:timing] ").unwrap()).unwrap())
    .collect()
}

pub(super) fn capture_lines(run: impl FnOnce()) -> Vec<String> {
    collect_lines(run, Arc::new(Unimock::new(())))
}

fn collect_lines(run: impl FnOnce(), clock: Arc<dyn Clock>) -> Vec<String> {
    let records = Arc::new(Mutex::new(Vec::new()));
    let output = records.clone();
    let terminal = Unimock::new(TerminalMock::stderr.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, line| {
            output.lock().unwrap().push(line.to_owned());
        }),
    ));
    let layer = Timings {
        terminal: Arc::new(terminal),
        session: "test".into(),
        clock,
        next: AtomicU64::new(1),
    };
    tracing::subscriber::with_default(tracing_subscriber::registry().with(layer), run);
    records.lock().unwrap().clone()
}

#[test]
fn comparison_records_keep_counts_and_parent_context_without_authored_data() {
    let records = capture(|| {
        let output = tracing::info_span!("output.write", status = "error");
        let _scope = output.enter();
        let comparison = tracing::info_span!(
            "review.compare-views",
            status = "error",
            views = tracing::field::Empty,
            unchanged = tracing::field::Empty,
            changed = tracing::field::Empty,
            ignored_only = tracing::field::Empty,
            path = "private.screen.html",
            source = "private document",
        );
        {
            let _scope = comparison.enter();
            let paths = tracing::info_span!("review.changed-paths", status = "error");
            let _scope = paths.enter();
            paths.record("status", "ok");
        }
        comparison.record("views", 6u64);
        comparison.record("unchanged", 1u64);
        comparison.record("changed", 3u64);
        comparison.record("ignored_only", 2u64);
        comparison.record("status", "ok");
        output.record("status", "ok");
    });
    assert_eq!(records.len(), 7);
    let output = &records[0];
    let comparison = &records[1];
    assert_eq!(comparison["parentId"], output["id"]);
    assert_eq!(records[2]["parentId"], comparison["id"]);
    assert_eq!(records[3]["stage"], "review.changed-paths");
    assert_eq!(records[3]["status"], "ok");
    let counts = &records[4];
    assert_eq!(counts["event"], "counts");
    assert_eq!(counts["id"], comparison["id"]);
    assert_eq!(counts["views"], 6);
    assert_eq!(counts["unchanged"], 1);
    assert_eq!(counts["changed"], 3);
    assert_eq!(counts["ignoredOnly"], 2);
    assert!(counts.get("documents").is_none());
    assert_eq!(records[5]["status"], "ok");
    for record in [&records[1], &records[5]] {
        for field in ["views", "unchanged", "changed", "ignoredOnly"] {
            assert!(record.get(field).is_none());
        }
    }
    for record in records {
        assert_eq!(record["session"], "test");
        assert_eq!(record["role"], "core");
        assert!(record.get("path").is_none());
        assert!(record.get("source").is_none());
    }
}

#[test]
fn unsuccessful_review_spans_remain_error_and_emit_no_complete_counts() {
    let records = capture(|| {
        let span = tracing::info_span!("review.compare-views", status = "error");
        let _scope = span.enter();
        {
            let span = tracing::info_span!("review.base-dependencies", status = "error");
            let _scope = span.enter();
        }
        let span = tracing::info_span!("review.changed-paths", status = "error");
        let _scope = span.enter();
    });
    assert_eq!(records.len(), 6);
    for record in records.iter().filter(|record| record["event"] == "end") {
        assert_eq!(record["status"], "error");
        assert!(record.get("tier").is_none());
    }
    assert!(records.iter().all(|record| record["event"] != "counts"));
}

#[test]
fn each_successful_dependency_tier_is_a_numeric_end_field() {
    let records = capture(|| {
        for tier in 1..=3u64 {
            let span = tracing::info_span!(
                "review.base-dependencies",
                status = "error",
                tier = tracing::field::Empty,
            );
            let _scope = span.enter();
            span.record("tier", tier);
            span.record("status", "ok");
        }
    });
    assert_eq!(records.len(), 6);
    for (index, pair) in records.chunks_exact(2).enumerate() {
        assert!(pair[0].get("tier").is_none());
        assert_eq!(pair[1]["status"], "ok");
        assert_eq!(pair[1]["tier"], index + 1);
    }
}
