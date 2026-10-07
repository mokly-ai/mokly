//! Cancellation diagnostics depend on typed run state rather than error text.

use crate::check::request::DependencyAudit;
use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

use super::harness_tests::{Case, harness};

#[test]
fn failed_cancellation_of_a_completed_run_prints_information() {
    let fixture = harness(Case::CancelCompleted);
    DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap();
    let events = fixture.events.lock().unwrap();
    assert!(
        !events
            .iter()
            .any(|event| event.contains("warning: cancellation"))
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| *event
                == "message:information: GitHub run=123 already ended; cancellation not needed")
            .count(),
        11
    );
}

#[test]
fn failed_cancellation_reads_the_run_state_before_warning() {
    let fixture = harness(Case::Cancel);
    DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap();
    let events = fixture.events.lock().unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| *event == "run-state:123")
            .count(),
        11
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.contains("warning: cancellation for 123 failed:"))
            .count(),
        11
    );
}

#[test]
fn a_failed_run_state_read_keeps_the_cancellation_warning() {
    let fixture = harness(Case::CancelReadFailure);
    DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap();
    let events = fixture.events.lock().unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| *event == "run-state:123")
            .count(),
        11
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.contains("warning: cancellation for 123 failed:"))
            .count(),
        11
    );
}
