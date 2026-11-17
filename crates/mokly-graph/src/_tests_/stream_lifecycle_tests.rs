//! Task panic cleanup and same-pool/default sequential stream behavior.

use std::sync::{Arc, Mutex};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::comparison_stream::{ComparisonConsumer, ComparisonConsumerMock};
use crate::workers::{ComparisonTaskMock, RenderWorkers, ThreadWorkers};

#[test]
fn a_panicking_stream_task_releases_completion_joins_and_propagates() {
    let admitted = Arc::new(Mutex::new(Vec::new()));
    let finished = Arc::new(Mutex::new(Vec::new()));
    let tasks = finished.clone();
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                let _finish = Finish {
                    tasks: &tasks,
                    index,
                };
                assert_ne!(index, 0, "deliberate worker assertion");
            })),
    );
    let admissions = admitted.clone();
    let mut consumer = PanicConsumer {
        admissions: Unimock::new(
            ComparisonConsumerMock::admit
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, index| {
                    if index < 8 {
                        admissions.lock().unwrap().push(index);
                        true
                    } else {
                        false
                    }
                })),
        ),
        consumed: Vec::new(),
    };
    let workers = ThreadWorkers::new(2).unwrap();
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        workers.comparison_stream(&task, &mut consumer);
    }));
    assert!(result.is_err(), "worker panic must propagate after joining");
    assert_eq!(*admitted.lock().unwrap(), [0, 1, 2, 3]);
    assert!(
        consumer.consumed.is_empty(),
        "a panicked result must never be consumed"
    );
    let mut finished = finished.lock().unwrap().clone();
    finished.sort_unstable();
    assert_eq!(finished, [0, 1, 2, 3]);
}

#[test]
fn same_pool_callers_and_default_providers_prepare_then_consume_sequentially() {
    let workers: Arc<dyn RenderWorkers> = Arc::new(ThreadWorkers::new(2).unwrap());
    let nested = workers.clone();
    let outer = Unimock::new(ComparisonTaskMock::run.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, _| {
            assert_sequential(nested.as_ref());
        }),
    ));
    workers.comparison_tasks(1, &outer);
    assert_sequential(&Unimock::new(()));
}

fn assert_sequential(workers: &dyn RenderWorkers) {
    let caller = thread::current().id();
    let events = Arc::new(Mutex::new(Vec::new()));
    let tasks = events.clone();
    let admissions = events.clone();
    let results = events.clone();
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                tasks
                    .lock()
                    .unwrap()
                    .push(("prepare", index, thread::current().id()));
            })),
    );
    let mut consumer = Unimock::new((
        ComparisonConsumerMock::admit
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                if index < 3 {
                    admissions
                        .lock()
                        .unwrap()
                        .push(("admit", index, thread::current().id()));
                    true
                } else {
                    false
                }
            })),
        ComparisonConsumerMock::consume
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                results
                    .lock()
                    .unwrap()
                    .push(("consume", index, thread::current().id()));
                true
            })),
    ));
    workers.comparison_stream(&task, &mut consumer);
    let expected: Vec<_> = (0..3)
        .flat_map(|index| ["admit", "prepare", "consume"].map(|stage| (stage, index, caller)))
        .collect();
    assert_eq!(*events.lock().unwrap(), expected);
}

struct PanicConsumer {
    admissions: Unimock,
    consumed: Vec<usize>,
}

impl ComparisonConsumer for PanicConsumer {
    fn admit(&mut self, index: usize) -> bool {
        self.admissions.admit(index)
    }
    fn consume(&mut self, index: usize) -> bool {
        self.consumed.push(index);
        true
    }
}

struct Finish<'a> {
    tasks: &'a Mutex<Vec<usize>>,
    index: usize,
}

impl Drop for Finish<'_> {
    fn drop(&mut self) {
        self.tasks.lock().unwrap().push(self.index);
    }
}
