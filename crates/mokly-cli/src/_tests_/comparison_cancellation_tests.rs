//! Comparison scheduling keeps the existing capacity and checks each queued input.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumerMock;
use mokly_graph::closure::Closure;
use mokly_graph::error::GraphError;
use mokly_graph::types::ComparisonDocument;
use mokly_graph::workers::{
    ComparisonTaskMock, ComparisonWorker, ComparisonWorkerMock, RenderWorkers, RenderWorkersMock,
};
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use unimock::{MockFn, Unimock, matching};

use crate::cancellation::CancellationMock;
use crate::cancelled_work::CancellableWorkers;

#[test]
fn capture_tasks_forward_capacity_and_keep_task_owned_cancellation_errors() {
    let cancelled = Arc::new(AtomicBool::new(false));
    let observed = cancelled.clone();
    let scheduler = Arc::new(CancellableWorkers {
        inner: Arc::new(Unimock::new((
            RenderWorkersMock::comparison_parallelism
                .next_call(matching!())
                .returns(3_usize),
            RenderWorkersMock::capture_window
                .each_call(matching!(_, _, _))
                .answers(&|_, _, task, consumer| {
                    for index in 0..3 {
                        task.run(index);
                        consumer.complete(index);
                    }
                }),
        ))),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::requested
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| observed.load(Ordering::SeqCst))),
        )),
    });
    assert_eq!(scheduler.comparison_parallelism(), 3);
    let worker = Unimock::new(
        ComparisonWorkerMock::input
            .next_call(matching!("first"))
            .answers_arc(Arc::new(move |_, _| {
                cancelled.store(true, Ordering::SeqCst);
                Ok(ComparisonDocument {
                    artifact: Arc::new(Artifact {
                        bytes: b"first".to_vec(),
                        content_type: "text/html".into(),
                        document: None,
                        fragment: None,
                    }),
                    closure: Closure::default(),
                })
            })),
    );
    let outputs = Arc::new(Mutex::new(Vec::new()));
    let recorded = outputs.clone();
    let checked = scheduler.clone();
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                let result = if checked.cancelled() {
                    Err(GraphError::Runtime {
                        source: RuntimeDiagnostic {
                            code: RuntimeCode::Cancelled,
                            message: "build cancelled".into(),
                        },
                    })
                } else {
                    worker.input(["first", "second", "third"][index])
                };
                recorded.lock().unwrap().push(result);
            })),
    );
    let mut consumer = Unimock::new(
        CaptureConsumerMock::complete
            .each_call(matching!(_))
            .returns(true),
    );
    scheduler.capture_window(3, &task, &mut consumer);
    let mut results = std::mem::take(&mut *outputs.lock().unwrap()).into_iter();
    assert_eq!(results.next().unwrap().unwrap().artifact.bytes, b"first");
    for result in results {
        let GraphError::Runtime { source } = result.unwrap_err() else {
            panic!("expected cancellation")
        };
        assert_eq!(source.code, RuntimeCode::Cancelled);
    }
}
