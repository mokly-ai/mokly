//! Install, rollback, and cleanup failures report their causes and keep the right bytes.

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use mokly_test_support::files::tree;

use super::support::{
    causes, export_category, fault_command, installed_bytes, joined, normalized, one_final_newline,
    output_directory, private_outputs, recovery_fixture, recovery_path, reservation, unsafe_entry,
};

const FAULTS: [&str; 6] = [
    "install",
    "install,restore",
    "backup-cleanup",
    "reservation-cleanup",
    "stage,stage-cleanup",
    "setup,stage-cleanup",
];

fn missing(path: &Path) {
    assert_eq!(fs::metadata(path).unwrap_err().kind(), ErrorKind::NotFound);
}

fn failures_report_their_causes(verb: &str, mode: &str) {
    for fault in FAULTS {
        let root = recovery_fixture();
        let path = root.path();
        let previous = tree(&path.join(".context/previous"));
        let result = fault_command(path, verb, fault, mode, ".context/site").run();
        let output = output_directory(path, verb, &result.stdout);
        let _private = private_outputs(verb, &output);
        let recovery = reservation(&output);
        assert_eq!(result.code, Some(1), "{}", result.stderr);
        assert!(!result.stdout.contains("Built Mokly to"));
        assert!(!result.stdout.contains("Published Mokly catalogue"));
        export_category(&result.stderr);
        assert!(!result.stderr.contains("[mokly-static"));
        assert!(!result.stderr.contains("[mokly-platform"));
        match fault {
            "install" => {
                assert!(result.stderr.contains("injected install failure"));
                assert!(tree(&output) == previous);
                missing(&recovery);
            }
            "install,restore" => {
                causes(
                    &result.stderr,
                    "injected install failure",
                    "injected restore failure",
                );
                assert!(result.stderr.contains(&recovery_path(
                    path,
                    &recovery.join("backup"),
                    verb
                )));
                assert!(tree(&recovery.join("backup")) == previous);
                missing(&output);
            }
            "backup-cleanup" | "reservation-cleanup" => {
                assert!(
                    result
                        .stderr
                        .to_lowercase()
                        .contains("new site is installed")
                );
                assert!(
                    result
                        .stderr
                        .contains(&recovery_path(path, &recovery, verb))
                );
                installed_bytes(path, &output, verb);
                if fault == "backup-cleanup" {
                    assert!(tree(&recovery.join("backup")) == previous);
                }
            }
            _ => {
                assert!(result.stderr.contains("Recovery failed"));
                assert!(
                    result
                        .stderr
                        .contains(&recovery_path(path, &recovery, verb))
                );
                let entry = if fault.starts_with("stage") {
                    "stage/404.html"
                } else {
                    ".mokly-export-transaction"
                };
                causes(
                    &result.stderr,
                    &unsafe_entry(&joined(&recovery, entry)),
                    &format!("Recovery failed: {}", unsafe_entry(&recovery.join("stage"))),
                );
                assert!(tree(&output) == previous);
            }
        }
        let events = fs::read_to_string(path.join(".context/events")).unwrap();
        let events: Vec<_> = events.trim().split('\n').collect();
        if fault == "install" {
            assert_eq!(
                events,
                [
                    "capture",
                    "install",
                    "restore",
                    "remove-stage",
                    "reservation-unlink"
                ]
            );
        }
        let removals = events
            .iter()
            .filter(|event| **event == "remove-stage")
            .count();
        let kept = ["install,restore", "backup-cleanup"].contains(&fault);
        assert_eq!(removals, if kept { 0 } else { 1 });
        if mode == "plain" {
            let name = format!("{verb}_plain_{}", fault.replace([',', '-'], "_"));
            one_final_newline(&result.stderr);
            insta::assert_snapshot!(name, normalized(&result.stderr, path, &output, verb));
        }
    }
}

#[test]
fn build_plain_reports_install_rollback_and_cleanup_failures_with_retained_bytes() {
    failures_report_their_causes("build", "plain");
}

#[test]
fn build_rich_reports_install_rollback_and_cleanup_failures_with_retained_bytes() {
    failures_report_their_causes("build", "rich");
}

#[test]
fn publish_plain_reports_install_rollback_and_cleanup_failures_with_retained_bytes() {
    failures_report_their_causes("publish", "plain");
}

#[test]
fn publish_rich_reports_install_rollback_and_cleanup_failures_with_retained_bytes() {
    failures_report_their_causes("publish", "rich");
}
