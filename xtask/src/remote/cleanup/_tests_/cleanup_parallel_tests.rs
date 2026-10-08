//! Independent cleanup workers preserve each box's order and isolate panics.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::remote::cleanup::contracts::BoxCleanup;
use crate::remote::cleanup::guard::CleanupGuard;
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};

#[derive(Clone, Copy, PartialEq)]
enum Case {
    Retry,
    WorkerPanic,
    OuterPanic,
}

fn fixture(case: Case) -> (Dependencies, Arc<Mutex<Vec<String>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let statuses = events.clone();
    let closes = events.clone();
    let stops = events.clone();
    let waits = events.clone();
    let cancels = events.clone();
    let attempts = AtomicUsize::new(0);
    let (sender, receiver) = mpsc::channel();
    let receiver = Mutex::new(receiver);
    let shared = Arc::new(Unimock::new((
        BlacksmithDisconnectMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, id| {
                closes.lock().unwrap().push(format!("close:{id}"));
                Ok(Disconnection::Closed)
            })),
        ProgramsFindMock
            .each_call(matching!("gh"))
            .answers(&|_, _| Ok(true)),
        BlacksmithStatusMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, id| {
                statuses.lock().unwrap().push(format!("status:{id}"));
                if id == "tbx_a" && case == Case::WorkerPanic {
                    panic!("one status worker failed");
                }
                if id == "tbx_a" && case == Case::OuterPanic {
                    return Err(Error::Command {
                        operation: Operation::Blacksmith,
                        code: Some(1),
                        detail: None,
                    });
                }
                Ok(format!(
                    "/actions/runs/{}",
                    if id == "tbx_a" { 123 } else { 456 }
                ))
            })),
        BlacksmithStopMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, id| {
                let attempt = if id == "tbx_a" {
                    attempts.fetch_add(1, Ordering::SeqCst)
                } else {
                    0
                };
                stops
                    .lock()
                    .unwrap()
                    .push(format!("stop:{id}:{}", attempt + 1));
                if id == "tbx_b" {
                    let _ = sender.send(());
                }
                if id == "tbx_a" && case == Case::Retry && attempt == 0 {
                    Err(Error::Command {
                        operation: Operation::Blacksmith,
                        code: Some(1),
                        detail: None,
                    })
                } else {
                    Ok(())
                }
            })),
        GithubCancelMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, id| {
                cancels.lock().unwrap().push(format!("cancel:{id}"));
                Ok(())
            })),
        ReporterExecutorMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                if case == Case::OuterPanic {
                    panic!("cleanup reporter failed");
                }
            })),
    )));
    let clock = Arc::new(if case == Case::Retry {
        Unimock::new(ClockWaitMock.each_call(matching!(_)).answers_arc(Arc::new(
            move |_, duration| {
                assert_eq!(duration, Duration::from_secs(5));
                waits.lock().unwrap().push("wait:start".into());
                let _ = receiver
                    .lock()
                    .unwrap()
                    .recv_timeout(Duration::from_secs(10));
                waits.lock().unwrap().push("wait:end".into());
            },
        )))
    } else {
        Unimock::new(())
    });
    let unused = Arc::new(Unimock::new(()));
    (
        Dependencies {
            environment: unused.clone(),
            programs: shared.clone(),
            clock,
            snapshot: Arc::new(Unimock::new(())),
            git: unused.clone(),
            blacksmith: shared.clone(),
            github: shared.clone(),
            fingerprint: unused.clone(),
            aggregate: unused.clone(),
            logs: unused.clone(),
            interrupt: unused,
            reporter: shared,
            workspace: PathBuf::from("/workspace"),
        },
        events,
    )
}

#[test]
fn a_retrying_box_does_not_block_another_box_and_keeps_its_order() {
    let (dependencies, events) = fixture(Case::Retry);
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    cleanup.track("tbx_b");
    assert_eq!(
        cleanup.stop_boxes(&["tbx_a".into(), "tbx_b".into(), "tbx_a".into()]),
        0
    );
    let events = events.lock().unwrap();
    let position = |event| events.iter().position(|entry| entry == event).unwrap();
    assert!(position("stop:tbx_b:1") < position("stop:tbx_a:2"));
    assert!(position("close:tbx_b") < position("status:tbx_b"));
    assert!(position("status:tbx_b") < position("stop:tbx_b:1"));
    assert!(position("cancel:456") < position("stop:tbx_b:1"));
    let own: Vec<_> = events
        .iter()
        .filter(|event| !event.contains("tbx_b") && *event != "cancel:456")
        .map(String::as_str)
        .collect();
    assert_eq!(
        own,
        [
            "close:tbx_a",
            "status:tbx_a",
            "cancel:123",
            "stop:tbx_a:1",
            "wait:start",
            "wait:end",
            "status:tbx_a",
            "stop:tbx_a:2"
        ]
    );
}

#[test]
fn one_worker_panic_does_not_stop_another_box_cleanup() {
    let (dependencies, events) = fixture(Case::WorkerPanic);
    let result = {
        let cleanup = CleanupGuard::new(&dependencies);
        cleanup.track("tbx_a");
        cleanup.track("tbx_b");
        catch_unwind(AssertUnwindSafe(|| cleanup.stop_boxes(&cleanup.pending())))
    };
    assert_eq!(result.unwrap(), 1);
    let events = events.lock().unwrap();
    assert!(events.iter().any(|event| event == "stop:tbx_b:1"));
    assert!(events.iter().any(|event| event == "cancel:456"));
}

#[test]
fn outer_panic_cleanup_keeps_calls_running_when_worker_reporters_panic() {
    let (dependencies, events) = fixture(Case::OuterPanic);
    assert!(
        catch_unwind(AssertUnwindSafe(|| {
            let cleanup = CleanupGuard::new(&dependencies);
            cleanup.track("tbx_a");
            cleanup.track("tbx_b");
            panic!("runner unwinds");
        }))
        .is_err()
    );
    let events = events.lock().unwrap();
    assert!(events.iter().any(|event| event == "stop:tbx_a:1"));
    assert!(events.iter().any(|event| event == "stop:tbx_b:1"));
    assert!(events.iter().any(|event| event == "cancel:456"));
}
