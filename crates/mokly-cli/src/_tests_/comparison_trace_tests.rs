//! Comparison counts and indexed tasks keep timing data through CLI worker wrappers.

use std::sync::{Arc, Mutex};
use std::thread;

use mokly_graph::comparison_stream::ComparisonConsumerMock;
use mokly_graph::workers::{ComparisonTaskMock, RenderWorkers, ThreadWorkers};
use unimock::{MockFn, Unimock, matching};

use mokly_cli::cancellation::BuildCancellation;
use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::serial_stylesheets::SerialStylesheets;

use super::serve_trace_tests::capture;

#[test]
fn indexed_comparison_tasks_keep_parent_timing_through_cli_worker_wrappers() {
    for stream in [false, true] {
        let workers: Arc<dyn RenderWorkers> = Arc::new(SerialStylesheets {
            inner: Arc::new(CancellableWorkers {
                inner: Arc::new(ThreadWorkers::new(2).unwrap()),
                cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
            }),
        });
        let caller = thread::current().id();
        let threads = Arc::new(Mutex::new(Vec::new()));
        let recorded = threads.clone();
        let check = workers.clone();
        let task = Unimock::new(ComparisonTaskMock::run.each_call(matching!(_)).answers_arc(
            Arc::new(move |_, _| {
                recorded.lock().unwrap().push(thread::current().id());
                assert!(!check.cancelled());
                let _span = tracing::info_span!("review.resource-graph").entered();
            }),
        ));
        let records = capture(|| {
            let _parent = tracing::info_span!("review.compare-views").entered();
            if stream {
                let mut consumer = Unimock::new((
                    ComparisonConsumerMock::admit
                        .each_call(matching!(_))
                        .answers(&|_, index| index < 2),
                    ComparisonConsumerMock::consume
                        .each_call(matching!(_))
                        .answers_arc(Arc::new(move |_, _| {
                            assert_eq!(thread::current().id(), caller);
                            true
                        })),
                ));
                workers.comparison_stream(&task, &mut consumer);
            } else {
                workers.comparison_tasks(2, &task);
            }
        });
        assert_eq!(threads.lock().unwrap().len(), 2);
        assert!(
            threads
                .lock()
                .unwrap()
                .iter()
                .all(|thread| *thread != caller)
        );
        let parent = records
            .iter()
            .find(|record| record["stage"] == "review.compare-views" && record["event"] == "start")
            .unwrap();
        let children: Vec<_> = records
            .iter()
            .filter(|record| record["stage"] == "review.resource-graph")
            .collect();
        assert_eq!(children.len(), 4);
        assert!(
            children
                .iter()
                .all(|record| record["parentId"] == parent["id"])
        );
        assert_eq!(
            children
                .iter()
                .filter(|record| record["event"] == "end" && record["status"] == "ok")
                .count(),
            2
        );
    }
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
            admitted_views = tracing::field::Empty,
            unchanged = tracing::field::Empty,
            changed = tracing::field::Empty,
            ignored_only = tracing::field::Empty,
            path = "private.screen.html",
            source = "private document",
        );
        {
            let _scope = comparison.enter();
            let paths = tracing::info_span!("review.resource-graph", status = "error");
            let _scope = paths.enter();
            paths.record("status", "ok");
        }
        comparison.record("views", 6u64);
        comparison.record("admitted_views", 4u64);
        comparison.record("unchanged", 1u64);
        comparison.record("changed", 3u64);
        comparison.record("ignored_only", 2u64);
        comparison.record("status", "ok");
        output.record("status", "ok");
    });
    assert_eq!(records.len(), 9);
    let output = &records[0];
    let comparison = &records[1];
    assert_eq!(comparison["parentId"], output["id"]);
    assert_eq!(records[2]["parentId"], comparison["id"]);
    assert_eq!(records[3]["stage"], "review.resource-graph");
    assert_eq!(records[3]["status"], "ok");
    let counts = &records[4];
    assert_eq!(counts["event"], "counts");
    assert_eq!(counts["id"], comparison["id"]);
    assert_eq!(counts["views"], 6);
    assert_eq!(counts["admittedViews"], 4);
    assert_eq!(counts["unchanged"], 1);
    assert_eq!(counts["changed"], 3);
    assert_eq!(counts["ignoredOnly"], 2);
    assert!(counts.get("documents").is_none());
    assert_eq!(records[5]["stage"], "render.cache");
    assert_eq!(records[5]["restores"], 0);
    assert_eq!(records[5]["restoreFailures"], 0);
    assert_eq!(records[5]["parentId"], comparison["id"]);
    assert_eq!(records[6]["status"], "ok");
    assert_eq!(records[6]["admittedViews"], 4);
    assert_eq!(records[7]["stage"], "render.cache");
    assert_eq!(records[7]["restores"], 0);
    assert_eq!(records[7]["restoreFailures"], 0);
    assert_eq!(records[7]["parentId"], output["id"]);
    assert_eq!(records[8]["id"], output["id"]);
    for record in [&records[1], &records[5], &records[6], &records[7]] {
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
