//! Snapshot runner identity, phase order and cleanup behavior at mocked boundaries.

use std::panic::{AssertUnwindSafe, catch_unwind};

use crate::check::request::DependencyAudit;
use crate::remote::error::{Error, Operation};
use crate::remote::runner::{DefaultRemoteRunner, Failure, RemoteRunner};

use self::snapshot_runner_support::{Case, fixture};

#[path = "snapshot_runner_support.rs"]
mod snapshot_runner_support;

#[path = "snapshot_runner_client.rs"]
mod snapshot_runner_client;

/// The expected count is operation count, never elapsed wall-clock time.
fn count(events: &[String], name: &str) -> usize {
    events.iter().filter(|event| event.as_str() == name).count()
}

/// Compare captured phase positions, including both fingerprint directories.
#[test]
fn snapshot_runs_use_the_base_and_follow_the_preparation_and_execution_order() {
    for case in [Case::SameHead, Case::BehindHead] {
        let fixture = fixture(case);
        DefaultRemoteRunner {
            dependencies: fixture.dependencies,
        }
        .run(DependencyAudit::Baseline)
        .unwrap();
        let events = fixture.events.lock().unwrap();
        let position = |name: &str| events.iter().position(|event| event == name).unwrap();
        let identity = events
            .iter()
            .position(|event| event.starts_with("identity:"))
            .unwrap();
        let line = events
            .iter()
            .position(|event| event.starts_with("message:information: run="))
            .unwrap();
        assert!(position("head") < position("base"));
        assert!(position("base") < position("create"));
        assert!(position("create") < position("fingerprint:/workspace"));
        assert!(
            position("fingerprint:/workspace")
                < position(
                    "fingerprint:/workspace/.context/verification-snapshots/20261006T120000Z-42"
                )
        );
        assert!(line < identity && identity < position("warmup"));
        assert!(
            events
                .iter()
                .take(position("suite"))
                .filter(|event| event.as_str() == "probe")
                .count()
                == 11
        );
        assert_eq!(count(&events, "warmup"), 11);
        assert_eq!(count(&events, "suite"), 11);
        assert_eq!(count(&events, "download"), 9);
        assert_eq!(count(&events, "remove"), 1);
        let final_fingerprint = events
            .iter()
            .rposition(|event| event == "fingerprint:/workspace")
            .unwrap();
        assert!(
            position("aggregate") < final_fingerprint && final_fingerprint < position("remove")
        );
        let base = if case == Case::BehindHead {
            "d".repeat(40)
        } else {
            "b".repeat(40)
        };
        let ahead = if case == Case::BehindHead { 3 } else { 0 };
        assert_eq!(
            events[line],
            format!(
                "message:information: run=20261006T120000Z-42 ref=main HEAD={} base={base} ahead={ahead}",
                "b".repeat(40)
            )
        );
        assert!(events.iter().any(|event| {
            event.contains(
                "summary: commands=11/11 reports=9/9 aggregate=passed unchanged-tree=true",
            ) && event.contains(&format!("base={base}"))
        }));
    }
}

/// Every preparation outcome retains its typed reason and removes acquired snapshots.
#[test]
fn preparation_failures_remove_snapshots_before_any_warmup() {
    for case in [
        Case::NoBase,
        Case::BuildFailure,
        Case::Mismatch,
        Case::Interrupt,
        Case::IdentityFailure,
        Case::FingerprintFailure,
    ] {
        let fixture = fixture(case);
        let result = DefaultRemoteRunner {
            dependencies: fixture.dependencies,
        }
        .run(DependencyAudit::Baseline);
        match (case, result) {
            (Case::NoBase, Err(Failure::Unavailable(Error::NoBase)))
            | (Case::Mismatch, Err(Failure::Unavailable(Error::SnapshotFingerprint { .. })))
            | (Case::Interrupt, Err(Failure::Failed(Error::Interrupted { cleanup: 0 })))
            | (
                Case::BuildFailure,
                Err(Failure::Unavailable(Error::Io {
                    operation: Operation::Snapshot,
                    ..
                })),
            )
            | (
                Case::IdentityFailure,
                Err(Failure::Unavailable(Error::Io {
                    operation: Operation::Logs,
                    ..
                })),
            )
            | (
                Case::FingerprintFailure,
                Err(Failure::Unavailable(Error::Io {
                    operation: Operation::Fingerprint,
                    ..
                })),
            ) => {}
            (_, result) => panic!("{case:?}: {result:?}"),
        }
        let events = fixture.events.lock().unwrap();
        assert_eq!(count(&events, "warmup"), 0, "{case:?}");
        assert_eq!(count(&events, "suite"), 0, "{case:?}");
        assert_eq!(
            count(&events, "remove"),
            usize::from(!matches!(case, Case::NoBase | Case::BuildFailure)),
            "{case:?}"
        );
        if case == Case::Interrupt {
            assert!(!events.iter().any(|event| event.starts_with("fingerprint:")));
        }
    }
}

/// A panic after construction still removes the snapshot through its guard.
#[test]
fn identity_writer_panic_removes_the_snapshot_without_warming_boxes() {
    let fixture = fixture(Case::IdentityPanic);
    let runner = DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    };
    assert!(catch_unwind(AssertUnwindSafe(|| runner.run(DependencyAudit::Baseline))).is_err());
    let events = fixture.events.lock().unwrap();
    assert_eq!(count(&events, "remove"), 1);
    assert_eq!(count(&events, "warmup"), 0);
}

/// Cleanup errors and panics only warn once and preserve successful verification.
#[test]
fn removal_and_warning_panics_never_fail_the_check_or_repeat_cleanup() {
    for case in [Case::RemoveFailure, Case::RemovePanic, Case::WarningPanic] {
        let fixture = fixture(case);
        DefaultRemoteRunner {
            dependencies: fixture.dependencies,
        }
        .run(DependencyAudit::Baseline)
        .unwrap();
        let events = fixture.events.lock().unwrap();
        assert_eq!(count(&events, "remove"), 1);
        let warnings: Vec<_> = events
            .iter()
            .filter(|event| event.contains("snapshot cleanup failed"))
            .collect();
        assert_eq!(warnings.len(), 1);
        for command in [
            "git worktree remove --force --force",
            "git worktree prune",
            "rm -f",
        ] {
            assert!(warnings[0].contains(command));
        }
    }
}
