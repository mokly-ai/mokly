//! Comparison scheduling keeps the existing capacity and checks each queued input.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::error::GraphError;
use mokly_graph::types::ComparisonDocument;
use mokly_graph::workers::{ComparisonWorkerMock, RenderWorkers, RenderWorkersMock};
use mokly_model::runtime_diagnostic::RuntimeCode;
use unimock::{MockFn, Unimock, matching};

use crate::cancellation::CancellationMock;
use crate::cancelled_work::CancellableWorkers;

#[test]
fn comparison_batches_forward_capacity_and_stop_each_cancelled_queued_input() {
    let cancelled = Arc::new(AtomicBool::new(false));
    let observed = cancelled.clone();
    let scheduler = CancellableWorkers {
        inner: Arc::new(Unimock::new((
            RenderWorkersMock::comparison_parallelism
                .next_call(matching!())
                .returns(3_usize),
            RenderWorkersMock::comparison
                .each_call(matching!(_, _))
                .answers(&|_, routes, worker| {
                    routes.iter().map(|route| worker.input(route)).collect()
                }),
        ))),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::requested
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| observed.load(Ordering::SeqCst))),
        )),
    };
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
    let mut results = scheduler
        .comparison(&["first".into(), "second".into(), "third".into()], &worker)
        .into_iter();
    assert_eq!(results.next().unwrap().unwrap().artifact.bytes, b"first");
    for result in results {
        let GraphError::Runtime { source } = result.unwrap_err() else {
            panic!("expected cancellation")
        };
        assert_eq!(source.code, RuntimeCode::Cancelled);
    }
}
