//! Final cleanup counts boxes instead of stop attempts.

use crate::check::request::DependencyAudit;
use crate::remote::error::{Error, TreeCheck};
use crate::remote::runner::{DefaultRemoteRunner, Failure, RemoteRunner};

use super::harness_tests::{Case, harness, stuck_harness};

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
fn an_unrecovered_box_after_passing_suites_only_warns() {
    let fixture = harness(Case::CleanupSuites);
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
        .is_ok()
    );
    assert_eq!(fixture.events.lock().unwrap().iter().filter(|event| *event == "message:warning: box=tbx_0 cleanup failed; run blacksmith testbox stop --id tbx_0; the 30-minute idle timeout ends it").count(), 1);
}

#[test]
fn a_check_that_fails_for_another_reason_still_reports_the_unrecovered_box() {
    let fixture = harness(Case::CleanupFailedSuite);
    let error = DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap_err();
    let message = error.to_string();
    assert!(
        message.contains("verification failed: 1 commands"),
        "{message}"
    );
    assert!(message.contains("cleanup=1"), "{message}");
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

#[test]
fn every_result_after_final_cleanup_reports_the_exact_cleanup_count() {
    for stuck in [false, true] {
        let expected = usize::from(stuck);
        for case in [
            Case::Suite,
            Case::Download,
            Case::Aggregate,
            Case::ChangedTree,
            Case::FinalFingerprint,
            Case::LateInterrupt,
            Case::SignalledFingerprint,
        ] {
            let fixture = if stuck {
                stuck_harness(case)
            } else {
                harness(case)
            };
            let result = DefaultRemoteRunner {
                dependencies: fixture.dependencies,
            }
            .run(DependencyAudit::Baseline);
            let cleanup = match (case, result) {
                (
                    Case::LateInterrupt | Case::SignalledFingerprint,
                    Err(Failure::Failed(Error::Interrupted { cleanup })),
                ) => cleanup,
                (
                    _,
                    Err(Failure::Failed(Error::Verification {
                        commands,
                        reports,
                        aggregate_failed,
                        tree,
                        cleanup,
                    })),
                ) => {
                    let failure = (commands, reports != 0, aggregate_failed, tree);
                    let required = match case {
                        Case::Suite => (1, false, false, TreeCheck::Unchanged),
                        Case::Download => (0, true, false, TreeCheck::Unchanged),
                        Case::Aggregate => (0, false, true, TreeCheck::Unchanged),
                        Case::ChangedTree => (0, false, false, TreeCheck::Changed),
                        Case::FinalFingerprint => (0, false, false, TreeCheck::Unreadable),
                        _ => panic!("{case:?} stuck={stuck} must end as interrupted"),
                    };
                    assert_eq!(failure, required, "{case:?} stuck={stuck}");
                    cleanup
                }
                (_, other) => panic!("{case:?} stuck={stuck}: {other:?}"),
            };
            assert_eq!(cleanup, expected, "{case:?} stuck={stuck}");
        }
    }
}
