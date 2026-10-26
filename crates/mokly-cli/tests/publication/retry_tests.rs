//! A publication retries exact bytes, keeps its deployment, and stops on SIGINT or a source edit.

use std::fs;
#[cfg(unix)]
use std::sync::Arc;

#[cfg(unix)]
use mokly_test_support::process::{self, ChildId};
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::receiver::{Exchange, Options};
use regex::Regex;
use serde_json::Value;

use super::support::{in_order, missing, mokly};

#[test]
fn real_publish_retries_exact_bytes_and_preserves_deployment_identity() {
    let root = publication::fixture(false, "sha1");
    let receiver = Exchange::start(Options {
        retry_status: Some(503),
        ..Options::default()
    });
    let mut outputs = Outputs::default();
    let mut deployment: Option<String> = None;
    for mode in ["rich", "plain"] {
        let running =
            publication::publish(&mokly(), root.path(), &receiver.endpoint, mode, &[]).spawn();
        receiver.observe(running.build_directory());
        let result = running.wait();
        let output = publication::directory(&result.stdout);
        outputs.push(output.clone());
        assert_eq!(result.code, Some(0), "{}", result.stderr);
        assert_eq!(result.stderr, "");
        let record = receiver.record();
        let received = record.completed_inventories.last().unwrap();
        let index: Value = serde_json::from_slice(&received["mokly-viewer/index.json"]).unwrap();
        assert_eq!(index["revision"], 0);
        assert!(index.get("live").is_none());
        let current = index["deploymentId"].as_str().unwrap().to_owned();
        if let Some(previous) = &deployment {
            assert_eq!(&current, previous);
        }
        deployment = Some(current);
        missing(&output);
        missing(output.parent().unwrap());
        if mode == "rich" {
            in_order(
                &result.stdout,
                &[
                    "Loading configuration",
                    "Rendering catalogue",
                    "Writing static output",
                    "Preparing upload",
                    "Uploading catalogue",
                    "Published Mokly catalogue",
                ],
            );
        } else {
            assert!(result.stdout.contains("already published for this commit"));
        }
        assert!(!result.stdout.contains(TOKEN));
    }
    let record = receiver.record();
    assert_eq!(record.completed, 2);
    assert_eq!(record.bodies[0], record.bodies[1]);
    assert!(record.attempts.values().all(|count| *count == 2));
    receiver.close();
}

#[cfg(unix)]
#[test]
fn sigint_during_plan_cancels_publication_and_retains_the_complete_build() {
    let root = publication::fixture(false, "sha1");
    let child = ChildId::default();
    let interrupted = child.clone();
    let receiver = Exchange::start(Options {
        hold_plan: Some(Arc::new(move || process::signal(interrupted.wait(), "INT"))),
        ..Options::default()
    });
    let running =
        publication::publish(&mokly(), root.path(), &receiver.endpoint, "plain", &[]).spawn();
    child.set(running.pid());
    let result = running.wait();
    let output = publication::directory(&result.stdout);
    let mut outputs = Outputs::default();
    outputs.push(output.clone());
    assert_eq!(result.code, Some(1));
    assert_eq!(
        result.stderr,
        "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n"
    );
    assert_eq!(receiver.record().completed, 0);
    assert!(output.join(".mokly-export-artifact").is_file());
    assert_eq!(
        fs::read_to_string(
            output
                .parent()
                .unwrap()
                .join(".mokly-export-reservations/.owner")
        )
        .unwrap(),
        "mokly-export-reservations-v1\n"
    );
    receiver.close();
}

#[test]
fn source_edits_during_publish_abort_before_the_first_receiver_request() {
    let root = publication::fixture(true, "sha1");
    let receiver = Exchange::start(Options::default());
    let result =
        publication::publish(&mokly(), root.path(), &receiver.endpoint, "plain", &[]).run();
    let output = publication::directory(&result.stdout);
    let mut outputs = Outputs::default();
    outputs.push(output.clone());
    assert_eq!(result.code, Some(1));
    let invalid = Regex::new(r"\[mokly/export-invalid\].*Inputs changed").unwrap();
    assert!(invalid.is_match(&result.stderr), "{}", result.stderr);
    assert!(receiver.record().bodies.is_empty());
    let source = fs::read_to_string(root.path().join("specs/home.mockup.ts")).unwrap();
    assert!(source.contains("// changed"));
    missing(&output);
    receiver.close();
}
