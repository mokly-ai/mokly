//! Captured phase output recovers cancellation when status has no run ID.

use crate::remote::runner::{DefaultRemoteRunner, Failure, RemoteRunner};

use super::harness_tests::{Case, harness};

fn check_recovery(case: Case, expected_id: u64, preparation_failure: bool) {
    let fixture = harness(case);
    let result = DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run();
    if preparation_failure {
        assert!(matches!(result, Err(Failure::Unavailable(_))));
    } else {
        result.unwrap();
    }
    let events = fixture.events.lock().unwrap();
    let warmed = events
        .iter()
        .filter(|event| event.starts_with("warm:"))
        .count();
    assert!(warmed > 0);
    assert_eq!(
        events
            .iter()
            .filter(|event| **event == format!("cancel:{expected_id}"))
            .count(),
        warmed
    );
    assert!(
        !events
            .iter()
            .any(|event| event.contains("no GitHub run ID"))
    );
}

#[test]
fn warmup_stdout_recovers_run_ids_when_status_fails() {
    check_recovery(Case::WarmupRunId, 456, false);
}

#[test]
fn failed_warmup_output_still_records_run_ids() {
    check_recovery(Case::WarmupRunIdFailure, 456, true);
}

#[test]
fn probe_stderr_recovers_run_ids_when_status_names_no_run() {
    check_recovery(Case::ProbeRunId, 789, false);
}

#[test]
fn failed_probe_output_still_records_run_ids() {
    check_recovery(Case::ProbeRunIdFailure, 789, true);
}

#[test]
fn status_run_ids_take_priority_over_captured_warmup_and_probe_ids() {
    check_recovery(Case::StatusRunId, 123, false);
}
