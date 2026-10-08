//! Failure, barrier, evidence and cleanup behavior over unimock seams.

use std::collections::BTreeSet;

use crate::check::request::DependencyAudit;
use crate::remote::error::Error;
use crate::remote::runner::{DefaultRemoteRunner, Failure, RemoteRunner};

use self::harness_tests::{Case, harness};

#[path = "harness_tests.rs"]
mod harness_tests;

#[path = "harness_client_tests.rs"]
mod harness_client_tests;

#[path = "harness_clock_tests.rs"]
mod harness_clock_tests;

#[path = "harness_github_tests.rs"]
mod harness_github_tests;

#[path = "harness_snapshot_tests.rs"]
mod harness_snapshot_tests;

#[test]
fn every_failed_run_cleans_all_recoverable_boxes() {
    for case in [
        Case::Warmup,
        Case::MultipleIds,
        Case::RepeatedBox,
        Case::NoId,
        Case::Probe,
        Case::Head,
        Case::Fingerprint,
        Case::Suite,
        Case::Download,
        Case::Aggregate,
        Case::ChangedTree,
        Case::InterruptWarmup,
        Case::InterruptSuites,
    ] {
        let fixture = harness(case);
        assert!(
            DefaultRemoteRunner {
                dependencies: fixture.dependencies
            }
            .run(DependencyAudit::Baseline)
            .is_err(),
            "{case:?}"
        );
        let events = fixture.events.lock().unwrap();
        let stopped: BTreeSet<_> = events
            .iter()
            .filter_map(|event| event.strip_prefix("stop:"))
            .collect();
        let warmed: BTreeSet<_> = events
            .iter()
            .filter_map(|event| event.strip_prefix("warm:"))
            .filter(|id| !(case == Case::NoId && *id == "tbx_0"))
            .collect();
        assert!(warmed.is_subset(&stopped), "{case:?}");
        if case == Case::MultipleIds {
            assert!(stopped.contains("tbx_extra"));
        }
        for id in &stopped {
            assert_eq!(
                events
                    .iter()
                    .filter(|event| **event == format!("stop:{id}"))
                    .count(),
                1,
                "{case:?}"
            );
            let status = events
                .iter()
                .position(|event| event == &format!("status:{id}"))
                .unwrap();
            let stop = events
                .iter()
                .position(|event| event == &format!("stop:{id}"))
                .unwrap();
            assert!(status < stop);
        }
        if matches!(
            case,
            Case::Warmup
                | Case::MultipleIds
                | Case::RepeatedBox
                | Case::NoId
                | Case::Probe
                | Case::Head
                | Case::Fingerprint
                | Case::InterruptWarmup
        ) {
            assert!(
                !events.iter().any(|event| event.starts_with("suite:")),
                "{case:?}"
            );
        }
        if case == Case::Suite {
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event.starts_with("download:"))
                    .count(),
                9
            );
        }
    }
}

#[test]
fn failed_cancel_and_missing_run_urls_only_warn() {
    for case in [Case::Cancel, Case::MissingRun] {
        let fixture = harness(case);
        DefaultRemoteRunner {
            dependencies: fixture.dependencies,
        }
        .run(DependencyAudit::Baseline)
        .unwrap();
        let events = fixture.events.lock().unwrap();
        assert!(
            events
                .iter()
                .any(|event| event.starts_with("message:warning:"))
        );
        if case == Case::MissingRun {
            assert!(!events.iter().any(|event| event.starts_with("cancel:")));
        }
    }
}

#[test]
fn interruption_is_nonzero_even_when_children_return_zero() {
    let fixture = harness(Case::InterruptSuites);
    assert!(matches!(
        DefaultRemoteRunner {
            dependencies: fixture.dependencies
        }
        .run(DependencyAudit::Baseline),
        Err(Failure::Failed(Error::Interrupted { cleanup: 0 }))
    ));
}

#[test]
fn preparation_failures_are_unavailable_and_later_failures_are_terminal() {
    for (case, unavailable) in [
        (Case::Warmup, true),
        (Case::Probe, true),
        (Case::Suite, false),
        (Case::Download, false),
        (Case::Aggregate, false),
        (Case::ChangedTree, false),
    ] {
        let fixture = harness(case);
        let result = DefaultRemoteRunner {
            dependencies: fixture.dependencies,
        }
        .run(DependencyAudit::Baseline);
        assert_eq!(
            matches!(result, Err(Failure::Unavailable(_))),
            unavailable,
            "{case:?}"
        );
    }
}

#[test]
fn preparation_cleanup_failure_cannot_allow_local_fallback() {
    let fixture = harness(Case::CleanupWarmup);
    assert!(matches!(
        DefaultRemoteRunner {
            dependencies: fixture.dependencies
        }
        .run(DependencyAudit::Baseline),
        Err(Failure::Failed(Error::PreparationCleanup { .. }))
    ));
    assert!(
        !fixture
            .events
            .lock()
            .unwrap()
            .iter()
            .any(|event| event.starts_with("suite:"))
    );
}

#[path = "panic_cleanup_tests.rs"]
mod panic_cleanup_tests;

#[path = "cleanup_count_tests.rs"]
mod cleanup_count_tests;

#[path = "run_id_recovery_tests.rs"]
mod run_id_recovery_tests;

#[path = "cancellation_tests.rs"]
mod cancellation_tests;

#[path = "warning_paths_tests.rs"]
mod warning_paths_tests;

#[path = "disconnect_runner_tests.rs"]
mod disconnect_runner_tests;

#[path = "snapshot_recovery_tests.rs"]
mod snapshot_recovery_tests;

#[path = "runner_evidence_tests.rs"]
mod runner_evidence_tests;
