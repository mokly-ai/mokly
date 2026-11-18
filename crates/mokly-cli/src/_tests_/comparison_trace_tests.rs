//! Indexed comparison tasks keep timing parentage through both CLI worker wrappers.

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
