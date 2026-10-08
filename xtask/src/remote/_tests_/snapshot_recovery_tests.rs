//! Snapshot release across existing box preparation, suite and panic recovery cases.

use std::panic::{AssertUnwindSafe, catch_unwind};

use crate::check::request::DependencyAudit;
use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

use super::harness_tests::{Case, harness};

/// Every existing recovery route removes the snapshot after its box cleanup.
#[test]
fn snapshot_removal_covers_box_errors_suite_errors_interrupts_and_panics() {
    for case in [
        Case::Success,
        Case::Warmup,
        Case::Probe,
        Case::Head,
        Case::Fingerprint,
        Case::Suite,
        Case::Download,
        Case::Aggregate,
        Case::ChangedTree,
        Case::InterruptWarmup,
        Case::InterruptSuites,
        Case::CleanupWarmup,
        Case::CleanupSuites,
        Case::PanicSuites,
    ] {
        let fixture = harness(case);
        let runner = DefaultRemoteRunner {
            dependencies: fixture.dependencies,
        };
        let result = catch_unwind(AssertUnwindSafe(|| runner.run(DependencyAudit::Baseline)));
        assert_eq!(result.is_err(), case == Case::PanicSuites, "{case:?}");
        let events = fixture.events.lock().unwrap();
        assert_eq!(
            events
                .iter()
                .filter(|event| event.as_str() == "snapshot:create")
                .count(),
            1,
            "{case:?}"
        );
        assert_eq!(
            events
                .iter()
                .filter(|event| event.as_str() == "snapshot:remove")
                .count(),
            1,
            "{case:?}"
        );
        let removal = events
            .iter()
            .position(|event| event == "snapshot:remove")
            .unwrap();
        assert!(
            events
                .iter()
                .enumerate()
                .filter(|(_, event)| event.starts_with("stop:"))
                .all(|(position, _)| position < removal),
            "{case:?}"
        );
    }
}
