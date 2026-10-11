//! One cancellation precedes stop and survives retries, final calls and panics.

use std::panic::{AssertUnwindSafe, catch_unwind};

use crate::remote::cleanup::contracts::BoxCleanup;
use crate::remote::cleanup::guard::CleanupGuard;

use self::support::{Cancel, Config, assert_cancel_line, fixture, operations};

#[path = "cancel_order_support.rs"]
mod support;

#[test]
fn recorded_run_is_cancelled_immediately_after_close_before_status() {
    let (dependencies, events) = fixture(Config {
        statuses: vec!["/actions/runs/456"],
        ..Config::default()
    });
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    cleanup.record_run("tbx_a", "/actions/runs/123");
    assert_eq!(cleanup.finish(), 0);
    let events = events.lock().unwrap();
    assert_eq!(
        operations(&events),
        ["close", "cancel:123", "status", "stop"]
    );
    assert_cancel_line(&events);
}

#[test]
fn status_discovered_run_is_cancelled_before_its_first_stop() {
    let (dependencies, events) = fixture(Config::default());
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.finish(), 0);
    let events = events.lock().unwrap();
    assert_eq!(
        operations(&events),
        ["close", "status", "cancel:123", "stop"]
    );
    assert_cancel_line(&events);
}

#[test]
fn no_run_id_warns_once_after_all_stop_attempts_and_never_cancels() {
    let (dependencies, events) = fixture(Config {
        statuses: vec!["ID STATUS\ntbx_a ready"],
        failed_stops: usize::MAX,
        ..Config::default()
    });
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 1);
    assert_eq!(cleanup.finish(), 1);
    assert_eq!(cleanup.finish(), 1);
    let events = events.lock().unwrap();
    assert!(!events.iter().any(|event| event.starts_with("cancel:")));
    let warning = "message:warning: no GitHub run ID for tbx_a; cancellation skipped";
    assert_eq!(
        events
            .iter()
            .filter(|event| event.as_str() == warning)
            .count(),
        1
    );
    let warning = events.iter().position(|event| event == warning).unwrap();
    assert!(
        events
            .iter()
            .enumerate()
            .filter(|(_, event)| event.as_str() == "stop")
            .all(|(index, _)| index < warning)
    );
}

#[test]
fn missing_gh_skips_only_cancellation_and_its_attempt_line() {
    let (dependencies, events) = fixture(Config {
        github: false,
        ..Config::default()
    });
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    cleanup.record_run("tbx_a", "/actions/runs/123");
    assert_eq!(cleanup.finish(), 0);
    let events = events.lock().unwrap();
    assert_eq!(operations(&events), ["close", "status", "stop"]);
    assert!(
        !events
            .iter()
            .any(|event| event.contains("information: cleanup box="))
    );
}

#[test]
fn failed_cancel_reads_state_before_status_and_suppresses_only_completed_warning() {
    for cancel in [Cancel::Completed, Cancel::Other] {
        let completed = matches!(cancel, Cancel::Completed);
        let (dependencies, events) = fixture(Config {
            cancel,
            ..Config::default()
        });
        let cleanup = CleanupGuard::new(&dependencies);
        cleanup.track("tbx_a");
        cleanup.record_run("tbx_a", "/actions/runs/123");
        assert_eq!(cleanup.finish(), 0);
        let events = events.lock().unwrap();
        assert_eq!(
            operations(&events),
            ["close", "cancel:123", "state:123", "status", "stop"]
        );
        assert_cancel_line(&events);
        assert_eq!(
            events
                .iter()
                .filter(|event| event.contains("warning: cancellation for 123 failed:"))
                .count(),
            usize::from(!completed)
        );
        assert_eq!(
            events
                .iter()
                .filter(|event| event.contains("already ended; cancellation not needed"))
                .count(),
            usize::from(completed)
        );
    }
}

#[test]
fn failed_state_read_prints_its_error_and_the_cancellation_error() {
    let (dependencies, events) = fixture(Config {
        cancel: Cancel::StateError,
        ..Config::default()
    });
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    cleanup.record_run("tbx_a", "/actions/runs/123");
    assert_eq!(cleanup.finish(), 0);
    let events = events.lock().unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| event.contains("warning: run state for 123 failed:")
                && event.contains("state failed"))
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(
                |event| event.contains("warning: cancellation for 123 failed:")
                    && event.contains("cancel failed")
            )
            .count(),
        1
    );
}

#[test]
fn completed_status_after_cancel_skips_stop_and_retains_one_cancel() {
    let (dependencies, events) = fixture(Config {
        statuses: vec!["ID STATUS\ntbx_a completed\n/actions/runs/456"],
        ..Config::default()
    });
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    cleanup.record_run("tbx_a", "/actions/runs/123");
    assert_eq!(cleanup.finish(), 0);
    let events = events.lock().unwrap();
    assert_eq!(operations(&events), ["close", "cancel:123", "status"]);
    assert_cancel_line(&events);
}

#[test]
fn initially_completed_status_skips_any_unattempted_cancellation() {
    let (dependencies, events) = fixture(Config {
        statuses: vec!["ID STATUS\ntbx_a completed\n/actions/runs/123"],
        ..Config::default()
    });
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.finish(), 0);
    assert_eq!(operations(&events.lock().unwrap()), ["close", "status"]);
}

#[test]
fn retries_final_cleanup_and_a_later_run_id_do_not_repeat_failed_cancellation() {
    let (dependencies, events) = fixture(Config {
        statuses: vec!["/actions/runs/123", "/actions/runs/456", "no run ID"],
        failed_stops: usize::MAX,
        cancel: Cancel::Other,
        ..Config::default()
    });
    let cleanup = CleanupGuard::new(&dependencies);
    cleanup.track("tbx_a");
    assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 1);
    assert_eq!(cleanup.finish(), 1);
    assert_eq!(cleanup.finish(), 1);
    let events = events.lock().unwrap();
    assert_eq!(
        operations(&events),
        [
            "close",
            "status",
            "cancel:123",
            "state:123",
            "stop",
            "wait:5",
            "status",
            "stop",
            "wait:10",
            "status",
            "stop",
            "status",
            "status"
        ]
    );
    assert_cancel_line(&events);
    assert!(
        !events
            .iter()
            .any(|event| event.contains("no GitHub run ID"))
    );
}

#[test]
fn panic_guard_does_not_repeat_a_cancellation_that_panicked() {
    let (dependencies, events) = fixture(Config {
        cancel: Cancel::Panic,
        ..Config::default()
    });
    assert!(
        catch_unwind(AssertUnwindSafe(|| {
            let cleanup = CleanupGuard::new(&dependencies);
            cleanup.track("tbx_a");
            cleanup.record_run("tbx_a", "/actions/runs/123");
            assert_eq!(cleanup.stop_boxes(&["tbx_a".into()]), 1);
            panic!("runner unwinds after the cancellation worker");
        }))
        .is_err()
    );
    let events = events.lock().unwrap();
    assert_eq!(
        operations(&events),
        ["close", "cancel:123", "status", "stop"]
    );
    assert_cancel_line(&events);
}
