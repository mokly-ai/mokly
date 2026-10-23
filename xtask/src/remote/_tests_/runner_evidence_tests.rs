//! Complete remote evidence and per-command download order assertions.

use crate::check::request::DependencyAudit;
use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

use super::harness_tests::{Case, harness};

#[test]
fn probe_diagnostic_counts_completed_boxes_before_starting_suites() {
    for case in [Case::Success, Case::Probe, Case::Fingerprint] {
        let fixture = harness(case);
        let result = DefaultRemoteRunner {
            dependencies: fixture.dependencies,
        }
        .run(DependencyAudit::Baseline);
        let events = fixture.events.lock().unwrap();
        let announcements: Vec<_> = events
            .iter()
            .enumerate()
            .filter(|(_, event)| event.ends_with("probes passed"))
            .collect();
        if case != Case::Success {
            assert!(result.is_err());
            assert!(announcements.is_empty());
            continue;
        }
        result.unwrap();
        let probes = events
            .iter()
            .filter(|event| event.starts_with("probe:"))
            .count();
        assert_eq!(probes, 7);
        assert_eq!(announcements.len(), 1);
        let (announced_at, message) = announcements[0];
        assert_eq!(
            message,
            &format!("message:information: all {probes} probes passed")
        );
        assert!(
            events[..announced_at]
                .iter()
                .filter(|event| event.starts_with("probe:"))
                .count()
                == probes
        );
        assert!(
            !events[..announced_at]
                .iter()
                .any(|event| event.starts_with("suite:"))
        );
    }
}

/// Keep the existing remote evidence and cleanup assertions.
#[test]
fn complete_remote_gate_downloads_five_reports_after_seven_commands() {
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
        7
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.starts_with("download:"))
            .count(),
        5
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.starts_with("stop:"))
            .count(),
        7
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
