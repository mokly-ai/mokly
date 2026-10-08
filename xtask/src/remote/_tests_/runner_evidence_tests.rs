//! Complete remote evidence and per-command download order assertions.

use crate::check::request::DependencyAudit;
use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

use super::harness_tests::{Case, harness};

/// Keep the existing remote evidence and cleanup assertions.
#[test]
fn complete_remote_gate_downloads_nine_reports_after_eleven_suites() {
    let fixture = harness(Case::Success);
    DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap();
    let events = fixture.events.lock().unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| event.starts_with("suite:"))
            .count(),
        11
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.starts_with("download:"))
            .count(),
        9
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.starts_with("stop:"))
            .count(),
        11
    );
    let aggregate = events
        .iter()
        .position(|event| event == "aggregate")
        .unwrap();
    assert!(
        events
            .iter()
            .enumerate()
            .filter(|(_, event)| event.starts_with("stop:"))
            .all(|(index, _)| index < aggregate)
    );
}

/// Keep the existing remote evidence and cleanup assertions.
#[test]
fn aggregate_summary_names_the_failed_outcome() {
    let fixture = harness(Case::Aggregate);
    assert!(
        DefaultRemoteRunner {
            dependencies: fixture.dependencies
        }
        .run(DependencyAudit::Baseline)
        .is_err()
    );
    assert!(fixture.events.lock().unwrap().iter().any(|event| event.contains("summary: commands=") && event.contains("aggregate=failed")));
}

/// Keep the existing remote evidence and cleanup assertions.
#[test]
fn each_report_download_precedes_its_box_stop() {
    let fixture = harness(Case::Success);
    DefaultRemoteRunner {
        dependencies: fixture.dependencies,
    }
    .run(DependencyAudit::Baseline)
    .unwrap();
    let events = fixture.events.lock().unwrap();
    for id in events
        .iter()
        .filter_map(|event| event.strip_prefix("download:"))
    {
        let download = events
            .iter()
            .position(|event| event == &format!("download:{id}"))
            .unwrap();
        let stop = events
            .iter()
            .position(|event| event == &format!("stop:{id}"))
            .unwrap();
        assert!(download < stop);
        assert_eq!(
            events
                .iter()
                .filter(|event| **event == format!("stop:{id}"))
                .count(),
            1
        );
    }
}
