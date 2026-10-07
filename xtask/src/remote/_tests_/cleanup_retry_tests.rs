//! Cleanup retry order uses captured clock requests rather than real waits.

use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::remote::cleanup::{BoxCleanup, CleanupGuard};
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};

fn fixture(failed_stops: usize, completes: bool) -> (Dependencies, Arc<Mutex<Vec<String>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let status_events = events.clone();
    let stop_events = events.clone();
    let wait_events = events.clone();
    let cancel_events = events.clone();
    let attempts = Arc::new(AtomicUsize::new(0));
    let observed_attempts = attempts.clone();
    let shared = Arc::new(Unimock::new((
        ProgramsFindMock
            .each_call(matching!("gh"))
            .answers(&|_, _| Ok(true)),
        BlacksmithStatusMock
            .each_call(matching!("tbx_a"))
            .answers_arc(Arc::new(move |_, _| {
                status_events.lock().unwrap().push("status".into());
                Ok(
                    if completes && observed_attempts.load(Ordering::SeqCst) > 0 {
                        "ID STATUS\ntbx_a completed\n/actions/runs/123".into()
                    } else {
                        "ID STATUS\ntbx_a running\n/actions/runs/123".into()
                    },
                )
            })),
        BlacksmithStopMock
            .each_call(matching!("tbx_a"))
            .answers_arc(Arc::new(move |_, _| {
                stop_events.lock().unwrap().push("stop".into());
                if attempts.fetch_add(1, Ordering::SeqCst) < failed_stops {
                    Err(Error::Command {
                        operation: Operation::Blacksmith,
                        code: Some(1),
                    })
                } else {
                    Ok(())
                }
            })),
        ClockWaitMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, duration| {
                assert!([Duration::from_secs(5), Duration::from_secs(10)].contains(&duration));
                wait_events
                    .lock()
                    .unwrap()
                    .push(format!("wait:{}", duration.as_secs()));
            })),
        ReporterExecutorMock.each_call(matching!(_)).returns(()),
    )));
    let unused = Arc::new(Unimock::new(()));
    (
        Dependencies {
            environment: unused.clone(),
            programs: shared.clone(),
            clock: shared.clone(),
            git: unused.clone(),
            blacksmith: shared.clone(),
            github: Arc::new(if completes {
                Unimock::new(())
            } else {
                Unimock::new(
                    GithubCancelMock
                        .each_call(matching!(123))
                        .answers_arc(Arc::new(move |_, _| {
                            cancel_events.lock().unwrap().push("cancel".into());
                            Ok(())
                        })),
                )
            }),
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
fn failed_stops_use_three_attempts_with_five_and_ten_second_waits() {
    let (dependencies, events) = fixture(3, false);
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 1);
    assert_eq!(
        *events.lock().unwrap(),
        [
            "status", "stop", "wait:5", "status", "stop", "wait:10", "status", "stop", "cancel"
        ]
    );
}

#[test]
fn a_second_attempt_success_has_no_ten_second_wait() {
    let (dependencies, events) = fixture(1, false);
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 0);
    assert!(cleanup.pending().is_empty());
    assert_eq!(
        *events.lock().unwrap(),
        ["status", "stop", "wait:5", "status", "stop", "cancel"]
    );
}

#[test]
fn completed_status_before_a_retry_skips_stop_and_cancellation() {
    let (dependencies, events) = fixture(1, true);
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 0);
    assert!(cleanup.pending().is_empty());
    assert_eq!(
        *events.lock().unwrap(),
        ["status", "stop", "wait:5", "status"]
    );
}

#[test]
fn later_cleanup_calls_cannot_exceed_three_stop_attempts() {
    let (dependencies, events) = fixture(usize::MAX, false);
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    for _ in 0..4 {
        assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 1);
    }
    let events = events.lock().unwrap();
    assert_eq!(events.iter().filter(|event| *event == "stop").count(), 3);
    assert_eq!(events.iter().filter(|event| *event == "cancel").count(), 1);
    assert_eq!(
        events
            .iter()
            .filter(|event| event.starts_with("wait:"))
            .count(),
        2
    );
}
