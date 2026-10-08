//! Close attempts precede all cleanup calls and survive retries and unwinding.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::cleanup::contracts::BoxCleanup;
use crate::remote::cleanup::guard::CleanupGuard;
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};

#[derive(Clone, Copy)]
enum Close {
    Closed,
    Absent,
    Failed,
    Panic,
}

fn fixture(close: Close, failed_stop: bool) -> (Dependencies, Arc<Mutex<Vec<String>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let closes = events.clone();
    let statuses = events.clone();
    let stops = events.clone();
    let cancels = events.clone();
    let messages = events.clone();
    let shared = Arc::new(Unimock::new((
        BlacksmithDisconnectMock
            .next_call(matching!("tbx_a"))
            .answers_arc(Arc::new(move |_, _| {
                closes.lock().unwrap().push("close".into());
                match close {
                    Close::Closed => Ok(Disconnection::Closed),
                    Close::Absent => Ok(Disconnection::Absent),
                    Close::Failed => Err(Error::MissingHome),
                    Close::Panic => panic!("close boundary panicked"),
                }
            })),
        ProgramsFindMock
            .each_call(matching!("gh"))
            .answers(&|_, _| Ok(true)),
        BlacksmithStatusMock
            .each_call(matching!("tbx_a"))
            .answers_arc(Arc::new(move |_, _| {
                statuses.lock().unwrap().push("status".into());
                Ok("/actions/runs/123".into())
            })),
        BlacksmithStopMock
            .each_call(matching!("tbx_a"))
            .answers_arc(Arc::new(move |_, _| {
                stops.lock().unwrap().push("stop".into());
                if failed_stop {
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
            .each_call(matching!(123))
            .answers_arc(Arc::new(move |_, _| {
                cancels.lock().unwrap().push("cancel".into());
                Ok(())
            })),
        ReporterExecutorMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                messages.lock().unwrap().push(format!("message:{text}"));
            })),
    )));
    let unused = Arc::new(Unimock::new(()));
    (
        Dependencies {
            environment: unused.clone(),
            programs: shared.clone(),
            clock: Arc::new(if failed_stop {
                Unimock::new(ClockWaitMock.each_call(matching!(_)).returns(()))
            } else {
                Unimock::new(())
            }),
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
fn closed_connection_is_first_and_has_no_close_output() {
    let (dependencies, events) = fixture(Close::Closed, false);
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 0);
    assert_eq!(cleanup.finish(), 0);
    let events = events.lock().unwrap();
    let operations: Vec<_> = events
        .iter()
        .filter(|event| !event.starts_with("message:"))
        .map(String::as_str)
        .collect();
    assert_eq!(operations, ["close", "status", "cancel", "stop"]);
    assert!(!events.iter().any(|event| event.contains("SSH connection")));
}

#[test]
fn absent_connection_prints_information_once_across_final_cleanup() {
    let (dependencies, events) = fixture(Close::Absent, true);
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 1);
    assert_eq!(cleanup.finish(), 1);
    assert_eq!(cleanup.finish(), 1);
    let events = events.lock().unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| event.as_str() == "close")
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(
                |event| event.as_str() == "message:information: no shared SSH connection for tbx_a"
            )
            .count(),
        1
    );
}

#[test]
fn failed_close_warns_once_and_does_not_change_cleanup_failure_counts() {
    for failed_stop in [false, true] {
        let (dependencies, events) = fixture(Close::Failed, failed_stop);
        let cleanup = CleanupGuard::new(&dependencies);
        cleanup.track("tbx_a");
        assert_eq!(
            cleanup.stop_boxes(&["tbx_a".into()]),
            usize::from(failed_stop)
        );
        assert_eq!(cleanup.finish(), usize::from(failed_stop));
        let events = events.lock().unwrap();
        let warning = "message:warning: could not close SSH connection for tbx_a: [xtask/remote] HOME is unset or empty; cannot close shared SSH connection";
        assert_eq!(
            events
                .iter()
                .filter(|event| event.as_str() == warning)
                .count(),
            1
        );
        let position = |event: &str| events.iter().position(|entry| entry == event).unwrap();
        assert!(position("close") < position(warning));
        assert!(position(warning) < position("status"));
        assert!(position("status") < position("stop"));
        assert!(position("cancel") < position("stop"));
    }
}

#[test]
fn one_close_survives_stop_retries_final_cleanup_and_the_panic_guard() {
    let (dependencies, events) = fixture(Close::Closed, true);
    assert!(
        catch_unwind(AssertUnwindSafe(|| {
            let cleanup = CleanupGuard::new(&dependencies);
            cleanup.track("tbx_a");
            assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 1);
            assert_eq!(cleanup.finish(), 1);
            panic!("runner unwinds after suite and final cleanup");
        }))
        .is_err()
    );
    let events = events.lock().unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| event.as_str() == "close")
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.as_str() == "stop")
            .count(),
        3
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.as_str() == "cancel")
            .count(),
        1
    );
}

#[test]
fn close_attempt_is_recorded_before_a_cleanup_worker_panics() {
    let (dependencies, events) = fixture(Close::Panic, false);
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 1);
    assert_eq!(cleanup.finish(), 0);
    let events = events.lock().unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| event.as_str() == "close")
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.as_str() == "stop")
            .count(),
        1
    );
}

#[test]
fn a_panicking_close_during_unwinding_does_not_prevent_status_stop_or_cancel() {
    let (dependencies, events) = fixture(Close::Panic, false);
    assert!(
        catch_unwind(AssertUnwindSafe(|| {
            let cleanup = CleanupGuard::new(&dependencies);
            cleanup.track("tbx_a");
            panic!("runner unwinds before cleanup");
        }))
        .is_err()
    );
    let events = events.lock().unwrap();
    let operations: Vec<_> = events
        .iter()
        .filter(|event| !event.starts_with("message:"))
        .map(String::as_str)
        .collect();
    assert_eq!(operations, ["close", "status", "cancel", "stop"]);
}
