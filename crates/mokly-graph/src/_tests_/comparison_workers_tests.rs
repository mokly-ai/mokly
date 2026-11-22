//! Comparison workers overlap independent inputs and return authored route order.

use std::sync::{Arc, Barrier, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::cache::Artifact;
use crate::capture_window::CaptureConsumerMock;
use crate::closure::Closure;
use crate::error::{GraphError, Result, invalid};
use crate::types::ComparisonDocument;
use crate::workers::{
    ComparisonTaskMock, ComparisonWorker, ComparisonWorkerMock, RenderWorkers, ThreadWorkers,
};

fn collect_inputs(
    workers: &dyn RenderWorkers,
    routes: &[String],
    worker: Unimock,
) -> Vec<Result<ComparisonDocument>> {
    let outputs = Arc::new(Mutex::new(std::collections::BTreeMap::new()));
    let prepared = outputs.clone();
    let routes = routes.to_vec();
    let count = routes.len();
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                let input = worker.input(&routes[index]);
                prepared.lock().unwrap().insert(index, input);
            })),
    );
    let mut consumer = Unimock::new((
        CaptureConsumerMock::admit
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| index < count)),
        CaptureConsumerMock::complete
            .each_call(matching!(_))
            .returns(true),
    ));
    workers.capture_window(workers.capture_parallelism(), &task, &mut consumer);
    let results = std::mem::take(&mut *outputs.lock().unwrap());
    results.into_values().collect()
}

#[test]
fn comparison_inputs_overlap_on_the_existing_pool_and_keep_route_order() {
    let workers = ThreadWorkers::new(2).unwrap();
    assert_eq!(workers.comparison_parallelism(), 2);
    let started = Arc::new(Barrier::new(2));
    let events = Arc::new(Mutex::new(Vec::new()));
    let recorded = events.clone();
    let worker = Unimock::new(
        ComparisonWorkerMock::input
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| {
                recorded.lock().unwrap().push(format!("start:{route}"));
                started.wait();
                recorded.lock().unwrap().push(format!("end:{route}"));
                Ok(ComparisonDocument {
                    artifact: Arc::new(Artifact {
                        bytes: route.as_bytes().to_vec(),
                        content_type: "text/html".into(),
                        document: None,
                        fragment: None,
                    }),
                    closure: Closure::default(),
                })
            })),
    );
    let results = collect_inputs(&workers, &["first".into(), "second".into()], worker);
    let bytes: Vec<_> = results
        .into_iter()
        .map(|input| input.unwrap().artifact.bytes.clone())
        .collect();
    assert_eq!(bytes, [b"first".to_vec(), b"second".to_vec()]);
    let events = events.lock().unwrap();
    assert_eq!(events.len(), 4);
    assert!(events[..2].iter().all(|event| event.starts_with("start:")));
    assert!(events[2..].iter().all(|event| event.starts_with("end:")));
}

#[test]
fn parallel_failures_keep_the_requested_route_order() {
    let workers = ThreadWorkers::new(2).unwrap();
    let worker = Unimock::new(
        ComparisonWorkerMock::input
            .each_call(matching!(_))
            .answers(&|_, route| Err(invalid(route, "fixture failure"))),
    );
    let routes = vec!["first".into(), "second".into()];
    let results = collect_inputs(&workers, &routes, worker);
    for (result, expected) in results.into_iter().zip(routes) {
        let GraphError::Invalid { route, .. } = result.unwrap_err() else {
            panic!("expected the original failure")
        };
        assert_eq!(route, expected);
    }
    assert_eq!(ThreadWorkers::new(0).unwrap().comparison_parallelism(), 1);
}
