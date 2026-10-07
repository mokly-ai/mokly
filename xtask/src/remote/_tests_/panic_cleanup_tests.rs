//! Panic recovery keeps paid resources covered even when output also panics.

use std::collections::BTreeSet;
use std::panic::{AssertUnwindSafe, catch_unwind};

use crate::check::request::DependencyAudit;
use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

use super::harness_tests::{Case, harness};

#[test]
fn suite_panic_and_cleanup_reporter_panics_still_stop_every_warmed_box() {
    let fixture = harness(Case::PanicSuites);
    let runner = DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    };
    assert!(catch_unwind(AssertUnwindSafe(|| runner.run(DependencyAudit::Baseline))).is_err());
    let events = fixture.events.lock().unwrap();
    let warmed: BTreeSet<_> = events
        .iter()
        .filter_map(|event| event.strip_prefix("warm:"))
        .collect();
    assert_eq!(warmed.len(), 11);
    for id in warmed {
        let status = events
            .iter()
            .position(|event| event == &format!("status:{id}"));
        let stop = events
            .iter()
            .position(|event| event == &format!("stop:{id}"));
        assert!(status.is_some(), "missing status for {id}");
        assert!(stop.is_some(), "missing stop for {id}");
        assert!(status < stop);
        assert_eq!(
            events
                .iter()
                .filter(|event| **event == format!("stop:{id}"))
                .count(),
            1
        );
    }
    assert_eq!(
        events.iter().filter(|event| *event == "cancel:123").count(),
        11
    );
}
