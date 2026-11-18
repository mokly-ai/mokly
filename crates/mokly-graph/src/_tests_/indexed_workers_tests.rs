//! Indexed work overlaps on the existing pool and completes every requested index once.

use std::sync::{Arc, Barrier, Mutex};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::workers::{ComparisonTaskMock, RenderWorkers, ThreadWorkers};

#[test]
fn indexed_tasks_overlap_once_on_the_existing_pool() {
    let barrier = Arc::new(Barrier::new(2));
    let recorded = Arc::new(Mutex::new(Vec::new()));
    let events = recorded.clone();
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                events.lock().unwrap().push((index, thread::current().id()));
                barrier.wait();
            })),
    );
    let caller = thread::current().id();
    ThreadWorkers::new(2).unwrap().comparison_tasks(2, &task);
    let mut events = recorded.lock().unwrap().clone();
    events.sort_by_key(|event| event.0);
    assert_eq!(
        events.iter().map(|event| event.0).collect::<Vec<_>>(),
        [0, 1]
    );
    assert_ne!(events[0].1, events[1].1);
    assert!(events.iter().all(|event| event.1 != caller));
}
