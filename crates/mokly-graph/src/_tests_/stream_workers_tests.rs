//! Rolling admission overlaps ordered caller work and joins every admitted task.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::comparison_stream::ComparisonConsumerMock;
use crate::workers::{ComparisonTaskMock, RenderWorkers, ThreadWorkers};

#[test]
fn rolling_stream_overlaps_refills_in_order_and_stops_admission_on_failure() {
    for stop in [None, Some(1)] {
        let caller = thread::current().id();
        let admitted = Arc::new(Mutex::new(Vec::new()));
        let consumed = Arc::new(Mutex::new(Vec::new()));
        let live = Arc::new(Mutex::new(Vec::new()));
        let completed = Arc::new(Mutex::new(Vec::new()));
        let overlap = Arc::new(AtomicBool::new(false));
        let pending = Arc::new(AtomicBool::new(false));
        let (started_send, started_receive) = mpsc::channel();
        let started_receive = Mutex::new(started_receive);
        let (release_send, release_receive) = mpsc::channel();
        let release_receive = Mutex::new(release_receive);
        let work = completed.clone();
        let running = pending.clone();
        let task = Unimock::new(ComparisonTaskMock::run.each_call(matching!(_)).answers_arc(
            Arc::new(move |_, index| {
                if thread::current().id() != caller {
                    if index == 0 {
                        let _ = started_receive.lock().unwrap().recv();
                    } else if index == 1 {
                        running.store(true, Ordering::SeqCst);
                        let _ = started_send.send(());
                        let _ = release_receive.lock().unwrap().recv();
                        running.store(false, Ordering::SeqCst);
                    }
                }
                work.lock().unwrap().push(index);
            }),
        ));
        let admissions = admitted.clone();
        let seen = admitted.clone();
        let results = consumed.clone();
        let counts = live.clone();
        let observed = overlap.clone();
        let mut consumer = Unimock::new((
            ComparisonConsumerMock::admit
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, index| {
                    if index < 6 {
                        admissions.lock().unwrap().push(index);
                        true
                    } else {
                        false
                    }
                })),
            ComparisonConsumerMock::consume
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, index| {
                    let release = Release(&release_send);
                    assert_eq!(thread::current().id(), caller);
                    if index == 0 {
                        observed.store(pending.load(Ordering::SeqCst), Ordering::SeqCst);
                    }
                    let mut consumed = results.lock().unwrap();
                    counts
                        .lock()
                        .unwrap()
                        .push(seen.lock().unwrap().len() - consumed.len());
                    consumed.push(index);
                    let _release = release;
                    stop != Some(index)
                })),
        ));
        ThreadWorkers::new(2)
            .unwrap()
            .comparison_stream(&task, &mut consumer);
        assert!(
            overlap.load(Ordering::SeqCst),
            "Phase B must run while a later Phase A is pending"
        );
        assert_eq!(
            *admitted.lock().unwrap(),
            if stop.is_some() {
                vec![0, 1, 2, 3, 4]
            } else {
                vec![0, 1, 2, 3, 4, 5]
            }
        );
        assert_eq!(
            *consumed.lock().unwrap(),
            if stop.is_some() {
                vec![0, 1]
            } else {
                vec![0, 1, 2, 3, 4, 5]
            }
        );
        assert_eq!(
            *live.lock().unwrap(),
            if stop.is_some() {
                vec![4, 4]
            } else {
                vec![4, 4, 4, 3, 2, 1]
            }
        );
        let mut completed = completed.lock().unwrap().clone();
        completed.sort_unstable();
        assert_eq!(
            completed,
            *admitted.lock().unwrap(),
            "all admitted work must join"
        );
    }
}

struct Release<'a>(&'a mpsc::Sender<()>);

impl Drop for Release<'_> {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}
