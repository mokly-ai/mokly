//! Scheduling keeps checked jobs, ordered consumption, and typed capture inputs.

use std::sync::{Arc, Mutex};

use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumerMock;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_stream::ComparisonConsumerMock;
use mokly_graph::types::{ComparisonDocument, RenderGeneration, RenderGenerationMock};
use mokly_graph::workers::{ComparisonTaskMock, ComparisonWorker, ComparisonWorkerMock};
use unimock::{MockFn, Unimock, matching};

use crate::comparison_graph::FrozenResources;

#[test]
fn frozen_schedulers_run_the_supplied_checked_jobs_and_preserve_index_and_capture_order() {
    let inner: Arc<dyn RenderGeneration> = Arc::new(Unimock::new((
        RenderGenerationMock::schedule_comparison_tasks
            .each_call(matching!(_, _))
            .answers(&|_, count, task| {
                for index in (0..count).rev() {
                    task.run(index);
                }
            }),
        RenderGenerationMock::schedule_comparison_stream
            .each_call(matching!(_, _))
            .answers(&|_, task, consumer| {
                let mut count = 0;
                while consumer.admit(count) {
                    count += 1;
                }
                for index in (0..count).rev() {
                    task.run(index);
                }
                for index in 0..count {
                    if !consumer.consume(index) {
                        break;
                    }
                }
            }),
        RenderGenerationMock::schedule_capture_window
            .each_call(matching!(_, _))
            .answers(&|_, task, consumer| {
                if consumer.admit(0) {
                    task.run(0);
                    consumer.complete(0);
                }
            }),
        RenderGenerationMock::comparison_document
            .each_call(matching!(_))
            .answers(&|_, _| {
                Ok(Arc::new(Artifact {
                    bytes: b"accepted".to_vec(),
                    content_type: "text/html".into(),
                    document: None,
                    fragment: None,
                }))
            }),
    )));
    let graph: Arc<dyn RenderGeneration> = Arc::new(FrozenResources::new(inner));
    let seen = Arc::new(Mutex::new(Vec::new()));
    let recorded = seen.clone();
    let checked = graph.clone();
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                let artifact = checked.comparison_document("sample/index.html").unwrap();
                recorded
                    .lock()
                    .unwrap()
                    .push((index, artifact.bytes.clone()));
            })),
    );
    graph.schedule_comparison_tasks(2, &task);
    assert_eq!(
        *seen.lock().unwrap(),
        [(1, b"accepted".to_vec()), (0, b"accepted".to_vec())]
    );
    let consumed = Arc::new(Mutex::new(Vec::new()));
    let recorded = consumed.clone();
    let mut consumer = Unimock::new((
        ComparisonConsumerMock::admit
            .each_call(matching!(_))
            .answers(&|_, index| index < 2),
        ComparisonConsumerMock::consume
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                recorded.lock().unwrap().push(index);
                true
            })),
    ));
    graph.schedule_comparison_stream(&task, &mut consumer);
    assert_eq!(*consumed.lock().unwrap(), [0, 1]);
    assert_eq!(
        *seen.lock().unwrap(),
        [
            (1, b"accepted".to_vec()),
            (0, b"accepted".to_vec()),
            (1, b"accepted".to_vec()),
            (0, b"accepted".to_vec())
        ]
    );
    let checked = graph.clone();
    let worker = Unimock::new(
        ComparisonWorkerMock::input
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| {
                Ok(ComparisonDocument {
                    artifact: checked.comparison_document(route)?,
                    closure: Closure::default(),
                })
            })),
    );
    let results = Arc::new(Mutex::new(Vec::new()));
    let prepared = results.clone();
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                prepared
                    .lock()
                    .unwrap()
                    .push(worker.input("sample/index.html"));
            })),
    );
    let mut capture = Unimock::new((
        CaptureConsumerMock::admit
            .each_call(matching!(_))
            .returns(true),
        CaptureConsumerMock::complete
            .each_call(matching!(_))
            .returns(true),
    ));
    graph.schedule_capture_window(&task, &mut capture);
    let results = std::mem::take(&mut *results.lock().unwrap());
    assert_eq!(
        results
            .into_iter()
            .map(|result| result.unwrap().artifact.bytes.clone())
            .collect::<Vec<_>>(),
        [b"accepted".to_vec()]
    );
}
