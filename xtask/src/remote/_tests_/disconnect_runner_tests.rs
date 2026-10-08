//! Suite, preparation and interrupt paths close each tracked box once.

use std::collections::BTreeSet;
use std::panic::{AssertUnwindSafe, catch_unwind};

use crate::check::request::DependencyAudit;
use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

use super::harness_tests::{Case, harness};

#[test]
fn all_runner_cleanup_paths_close_each_box_once_before_status_stop_or_cancel() {
    for case in [
        Case::Success,
        Case::Warmup,
        Case::Probe,
        Case::MultipleIds,
        Case::RepeatedBox,
        Case::InterruptWarmup,
        Case::InterruptSuites,
        Case::CleanupWarmup,
        Case::CleanupSuites,
        Case::CompletedOnRetry,
        Case::CompletedOnFinal,
        Case::PanicSuites,
    ] {
        let fixture = harness(case);
        let runner = DefaultRemoteRunner {
            dependencies: fixture.dependencies,
        };
        let result = catch_unwind(AssertUnwindSafe(|| runner.run(DependencyAudit::Baseline)));
        if case == Case::PanicSuites {
            assert!(result.is_err());
        } else {
            assert!(result.is_ok());
        }
        let events = fixture.events.lock().unwrap();
        let mut warmed: BTreeSet<_> = events
            .iter()
            .filter_map(|event| event.strip_prefix("warm:"))
            .collect();
        if case == Case::MultipleIds {
            warmed.insert("tbx_extra");
        }
        let closed: BTreeSet<_> = events
            .iter()
            .filter_map(|event| event.strip_prefix("disconnect:"))
            .collect();
        assert_eq!(closed, warmed, "{case:?}");
        for id in warmed {
            let close = format!("disconnect:{id}");
            assert_eq!(
                events.iter().filter(|event| **event == close).count(),
                1,
                "{case:?} {id}"
            );
            let close = events.iter().position(|event| *event == close).unwrap();
            for action in ["status", "stop"] {
                let action = format!("{action}:{id}");
                assert!(
                    events
                        .iter()
                        .enumerate()
                        .filter(|(_, event)| ***event == action)
                        .all(|(position, _)| close < position),
                    "{case:?} {action}"
                );
            }
            if let Some(download) = events
                .iter()
                .position(|event| *event == format!("download:{id}"))
            {
                assert!(download < close, "{case:?} {id}");
            }
        }
    }
}
