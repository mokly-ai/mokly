//! Signals during configuration, staging, and capture settle with the right output and copy.

#![cfg(unix)]

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use mokly_test_support::files::tree;

use super::support::{
    causes, export_category, normalized, output_directory, recovery_fixture, recovery_path,
    remove_private, reservation, signal_fault, unsafe_entry,
};

const FAULTS: [&str; 7] = [
    "config",
    "setup-signal",
    "setup-signal,stage-cleanup",
    "stage-signal",
    "capture-signal",
    "capture-signal,restore",
    "stage-signal,stage-cleanup",
];

fn missing(path: &Path) {
    let error = fs::metadata(path).unwrap_err();
    assert_eq!(error.kind(), ErrorKind::NotFound, "{}", path.display());
}

fn signals_settle(verb: &str, mode: &str) {
    for fault in FAULTS {
        let root = recovery_fixture();
        let path = root.path();
        let result = signal_fault(path, verb, mode, fault);
        let output = output_directory(path, verb, &result.stdout);
        assert_eq!(result.code, Some(1), "{fault}: {}", result.stderr);
        let failed_recovery = fault.contains(',');
        let recovery = reservation(&output);
        let cancelled = if verb == "build" {
            "build cancelled"
        } else {
            "Publication was cancelled"
        };
        if failed_recovery {
            export_category(&result.stderr);
            assert!(result.stderr.contains("Recovery failed"));
            assert!(
                result
                    .stderr
                    .contains(&recovery_path(path, &recovery, verb))
            );
            assert!(!result.stderr.contains("Publication was cancelled"));
            let (primary, cleanup) = if fault.starts_with("capture") {
                (
                    "build cancelled".to_owned(),
                    "injected restore failure".to_owned(),
                )
            } else {
                let entry = if fault.starts_with("setup") {
                    ".mokly-export-transaction"
                } else {
                    "stage/404.html"
                };
                (
                    unsafe_entry(&recovery.join(entry)),
                    format!("Recovery failed: {}", unsafe_entry(&recovery.join("stage"))),
                )
            };
            causes(&result.stderr, &primary, &cleanup);
        } else if fault == "setup-signal" {
            export_category(&result.stderr);
            assert!(
                result
                    .stderr
                    .contains(&unsafe_entry(&recovery.join(".mokly-export-transaction")))
            );
            assert!(!result.stderr.contains("cancelled"));
        } else if mode == "plain" {
            let expected = if verb == "build" {
                "[mokly/build-invalid] build cancelled\n"
            } else {
                "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n"
            };
            assert_eq!(result.stderr, expected);
        } else {
            assert!(result.stderr.contains(cancelled), "{}", result.stderr);
        }
        let previous = tree(&path.join(".context/previous"));
        if fault == "config" {
            missing(&output);
        } else if fault == "capture-signal,restore" {
            assert!(tree(&reservation(&output).join("backup")) == previous);
            missing(&output);
        } else {
            assert!(tree(&output) == previous, "{fault}");
        }
        if !failed_recovery && fault != "config" {
            missing(&reservation(&output));
        }
        if mode == "plain" {
            let name = format!("{verb}_plain_{}", fault.replace([',', '-'], "_"));
            insta::assert_snapshot!(name, normalized(&result.stderr, path, &output, verb));
        }
        remove_private(verb, &output);
    }
}

#[test]
fn build_plain_settles_configuration_staging_and_captured_output_signals() {
    signals_settle("build", "plain");
}

#[test]
fn build_rich_settles_configuration_staging_and_captured_output_signals() {
    signals_settle("build", "rich");
}

#[test]
fn publish_plain_settles_configuration_staging_and_captured_output_signals() {
    signals_settle("publish", "plain");
}

#[test]
fn publish_rich_settles_configuration_staging_and_captured_output_signals() {
    signals_settle("publish", "rich");
}
