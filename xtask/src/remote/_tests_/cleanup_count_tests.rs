//! Final cleanup counts boxes instead of stop attempts.

use crate::check::request::DependencyAudit;
use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

use super::harness_tests::{Case, harness};

#[test]
fn a_stop_that_succeeds_on_retry_does_not_fail_the_check() {
    let fixture = harness(Case::RetryStop);
    DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap();
    assert_eq!(
        fixture
            .events
            .lock()
            .unwrap()
            .iter()
            .filter(|event| *event == "stop:tbx_0")
            .count(),
        2
    );
}

#[test]
fn a_box_proven_completed_after_a_failed_stop_does_not_fail_the_check() {
    let fixture = harness(Case::CompletedOnRetry);
    DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap();
    assert_eq!(
        fixture
            .events
            .lock()
            .unwrap()
            .iter()
            .filter(|event| *event == "stop:tbx_0")
            .count(),
        1
    );
}

#[test]
fn an_unrecovered_box_counts_once_after_three_stop_attempts() {
    let fixture = harness(Case::CleanupSuites);
    let error = DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap_err();
    assert!(error.to_string().contains("cleanup=1"), "{error}");
    assert_eq!(
        fixture
            .events
            .lock()
            .unwrap()
            .iter()
            .filter(|event| *event == "stop:tbx_0")
            .count(),
        3
    );
}

#[test]
fn each_remaining_box_gets_one_manual_cleanup_warning() {
    let fixture = harness(Case::CleanupSuites);
    assert!(
        DefaultRemoteRunner {
            dependencies: fixture.dependencies
        }
        .run(DependencyAudit::Baseline)
        .is_err()
    );
    assert_eq!(fixture.events.lock().unwrap().iter().filter(|event| *event == "message:warning: box=tbx_0 cleanup failed; run blacksmith testbox stop --id tbx_0; the 30-minute idle timeout ends it").count(), 1);
}

#[test]
fn preparation_interrupt_reports_the_final_cleanup_count() {
    let fixture = harness(Case::InterruptCleanupWarmup);
    let error = DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("verification interrupted; cleanup=1 boxes remain"),
        "{error}"
    );
}

#[test]
fn suite_interrupt_reports_the_final_cleanup_count() {
    let fixture = harness(Case::InterruptCleanupSuites);
    let error = DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("verification interrupted; cleanup=1 boxes remain"),
        "{error}"
    );
}

#[test]
fn final_status_completion_clears_an_exhausted_box_without_another_stop() {
    let fixture = harness(Case::CompletedOnFinal);
    DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap();
    let events = fixture.events.lock().unwrap();
    assert_eq!(
        events.iter().filter(|event| *event == "stop:tbx_0").count(),
        3
    );
    assert!(
        !events
            .iter()
            .any(|event| event.contains("box=tbx_0 cleanup failed"))
    );
}
