//! Cleanup boundaries when the manager and one output worker stay pending.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use mokly_git::control::ClockMock;
use mokly_platform::processes::ProcessGroupMock;
use unimock::{MockFn, Unimock, matching};

use crate::commands::Child;
use crate::error::Error;

use super::OwnedChild;

#[test]
fn drop_detaches_a_pending_manager_and_reader_at_the_grace_boundary() {
    let milliseconds = Arc::new(AtomicU64::new(0));
    let observed = milliseconds.clone();
    let paused = milliseconds.clone();
    let clock = Unimock::new((
        ClockMock::now
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                Duration::from_millis(observed.load(Ordering::SeqCst))
            })),
        ClockMock::pause
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, duration| {
                paused.fetch_add(duration.as_millis() as u64, Ordering::SeqCst);
            })),
    ));
    let (_manager, process) = mpsc::channel();
    let (release, pending) = mpsc::channel();
    let (complete, completed) = mpsc::channel();
    let reader = thread::spawn(move || {
        pending.recv().unwrap();
        complete.send(()).unwrap();
        Ok(vec![])
    });
    {
        let _child: Box<dyn Child> = Box::new(OwnedChild {
            process: Mutex::new(process),
            status: None,
            group: Arc::new(Unimock::new(
                ProcessGroupMock::kill
                    .some_call(matching!())
                    .returns(Ok(())),
            )),
            clock: Arc::new(clock),
            stdout: Some(reader),
            stderr: None,
            output: vec![],
            finished: false,
        });
    }
    assert_eq!(milliseconds.load(Ordering::SeqCst), 100);
    assert_eq!(completed.try_recv(), Err(mpsc::TryRecvError::Empty));
    release.send(()).unwrap();
    completed.recv_timeout(Duration::from_secs(10)).unwrap();
}

#[test]
fn output_failure_is_reported_while_the_other_reader_and_manager_stay_pending() {
    let (_manager, process) = mpsc::channel();
    let (release, pending) = mpsc::channel();
    let failed = thread::spawn(|| Err(Error::CommandOutputLimit));
    let reader = thread::spawn(move || {
        pending.recv().unwrap();
        Ok(vec![])
    });
    while !failed.is_finished() {
        thread::yield_now();
    }
    let mut child: Box<dyn Child> = Box::new(OwnedChild {
        process: Mutex::new(process),
        status: None,
        group: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
        stdout: Some(failed),
        stderr: Some(reader),
        output: vec![],
        finished: false,
    });
    let result = child.poll();
    child.abandon();
    assert!(matches!(result, Err(Error::CommandOutputLimit)));
    assert_eq!(release.send(()), Ok(()));
}
