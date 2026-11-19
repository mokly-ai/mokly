//! A lower current capacity prevents completion admission without cancelling owners.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::thread;

use mokly_graph::background::Completion;
use unimock::{MockFn, Unimock, matching};

use crate::background_capacity::BackgroundCapacityMock;
use crate::background_stage::Stages;

#[test]
fn completion_admission_reads_capacity_after_shrink_and_preserves_existing_places() {
    let capacity = Arc::new(AtomicUsize::new(2));
    let (sent, reads) = mpsc::channel();
    let mock = Unimock::new(
        BackgroundCapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new({
                let capacity = capacity.clone();
                move |_| {
                    let count = capacity.load(Ordering::SeqCst);
                    sent.send(count).unwrap();
                    count
                }
            })),
    );
    let bound = Stages::new(Arc::new(mock.clone()));
    let first = bound.view("one");
    let second = bound.view("two");
    first.enter();
    second.enter();
    assert_eq!(reads.recv().unwrap(), 2);
    assert_eq!(reads.recv().unwrap(), 2);
    capacity.store(1, Ordering::SeqCst);
    let third = bound.view("three");
    let (ended, finished) = mpsc::channel();
    thread::scope(|scope| {
        let third = third.clone();
        scope.spawn(move || {
            third.enter();
            ended.send(()).unwrap();
        });
        assert_eq!(reads.recv().unwrap(), 1);
        assert_eq!(*bound.active.lock().unwrap(), 2);
        first.finish();
        assert_eq!(reads.recv().unwrap(), 1);
        assert_eq!(*bound.active.lock().unwrap(), 1);
        second.finish();
        finished.recv().unwrap();
    });
    assert_eq!(*bound.active.lock().unwrap(), 1);
    third.finish();
    assert_eq!(*bound.active.lock().unwrap(), 0);
}
