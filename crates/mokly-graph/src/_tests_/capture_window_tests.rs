//! Completion-driven admission refills slots before the first slow route finishes.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::capture_window::CaptureConsumerMock;
use crate::workers::{ComparisonTaskMock, RenderWorkers, ThreadWorkers};

#[test]
fn a_completed_later_route_refills_the_window_before_the_first_route_finishes() {
    let caller = thread::current().id();
    let pending = Arc::new(AtomicBool::new(false));
    let overlap = Arc::new(AtomicBool::new(false));
    let finished = Arc::new(Mutex::new(Vec::new()));
    let (first_send, first_receive) = mpsc::channel();
    let first_receive = Mutex::new(first_receive);
    let (release_send, release_receive) = mpsc::channel();
    let release_receive = Mutex::new(release_receive);
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let pending = pending.clone();
                let overlap = overlap.clone();
                let finished = finished.clone();
                move |_, index| {
                    if thread::current().id() != caller {
                        match index {
                            0 => {
                                pending.store(true, Ordering::SeqCst);
                                first_send.send(()).unwrap();
                                release_receive.lock().unwrap().recv().unwrap();
                                pending.store(false, Ordering::SeqCst);
                            }
                            1 => first_receive.lock().unwrap().recv().unwrap(),
                            2 => {
                                overlap.store(pending.load(Ordering::SeqCst), Ordering::SeqCst);
                                release_send.send(()).unwrap();
                            }
                            _ => {}
                        }
                    }
                    finished.lock().unwrap().push(index);
                }
            })),
    );
    let completed = Arc::new(Mutex::new(Vec::new()));
    let admitted = Arc::new(Mutex::new(Vec::new()));
    let admissions = admitted.clone();
    let initial = admitted.clone();
    let first = Arc::new(Mutex::new(None));
    let first_completion = first.clone();
    let received = completed.clone();
    let mut consumer = Unimock::new((
        CaptureConsumerMock::admit
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                if index < 6 {
                    admissions.lock().unwrap().push(index);
                    true
                } else {
                    false
                }
            })),
        CaptureConsumerMock::complete
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                first_completion
                    .lock()
                    .unwrap()
                    .get_or_insert(initial.lock().unwrap().len());
                received.lock().unwrap().push(index);
                true
            })),
    ));
    ThreadWorkers::new(4)
        .unwrap()
        .capture_window(2, &task, &mut consumer);
    assert!(
        overlap.load(Ordering::SeqCst),
        "route 2 must start while route 0 is pending"
    );
    assert_eq!(
        *first.lock().unwrap(),
        Some(2),
        "admission must use the supplied capacity even on a larger pool"
    );
    let mut finished = finished.lock().unwrap().clone();
    finished.sort_unstable();
    assert_eq!(finished, [0, 1, 2, 3, 4, 5]);
    let mut completed = completed.lock().unwrap().clone();
    completed.sort_unstable();
    assert_eq!(completed, [0, 1, 2, 3, 4, 5]);
}
