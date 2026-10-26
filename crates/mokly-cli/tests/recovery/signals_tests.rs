//! Signals during configuration, staging, and capture settle with the right output and copy,
//! and signal sessions release their handlers.

#![cfg(unix)]

use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};

use mokly_test_support::files::tree;
use mokly_test_support::process::Finished;
use mokly_test_support::publication;

use super::support::{
    causes, export_category, fault_command, joined, mokly, normalized, one_final_newline,
    output_directory, private_outputs, recovery_fixture, recovery_path, reservation, unsafe_entry,
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

/// Run `verb` with `fault`, send SIGINT at the fault's signal gate, and wait.
fn signal_fault(root: &Path, verb: &str, mode: &str, fault: &str) -> Finished {
    let expected = fault.split(',').next().unwrap();
    let ready = root.join(".context/ready");
    let mut running = fault_command(root, verb, fault, mode, ".context/site").spawn();
    let started = Instant::now();
    while fs::read_to_string(&ready).ok().as_deref() != Some(expected) {
        assert!(
            !running.has_exited(),
            "No fault readiness: {}",
            running.stderr()
        );
        assert!(
            started.elapsed() < Duration::from_secs(120),
            "the fault gate never became ready"
        );
        thread::sleep(Duration::from_millis(10));
    }
    running.signal("INT");
    running.wait()
}

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
        let _private = private_outputs(verb, &output);
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
                    unsafe_entry(&joined(&recovery, entry)),
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
            one_final_newline(&result.stderr);
            insta::assert_snapshot!(name, normalized(&result.stderr, path, &output, verb));
        }
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

#[test]
fn build_and_publish_signal_sessions_release_registrations_when_dropped() {
    let root = publication::fixture(false, "sha1");
    let result = mokly()
        .command(root.path(), &["build", "--no-changes"], "plain")
        .env("MOKLY_TEST_STATIC_FAULTS", "handlers")
        .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert_eq!(result.stdout, "signal-handlers-released\n");
    assert_eq!(result.stderr, "");
}
