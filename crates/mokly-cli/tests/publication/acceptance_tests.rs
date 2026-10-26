//! Assigned credentials stay private, and each retryable status is retried once.

use std::fs;

use mokly_test_support::git::commit_all;
use mokly_test_support::publication::{self, Outputs};
use mokly_test_support::receiver::{Exchange, Options};

use super::support::mokly;

#[test]
fn assigned_leading_dash_credentials_and_configuration_reach_the_receiver_without_diagnostic_leaks()
{
    let root = publication::fixture(false, "sha1");
    let token = "-synthetic/credential+padding==";
    let encoded = "-synthetic%2Fcredential%2Bpadding%3D%3D";
    let receiver = Exchange::start(Options {
        token: Some(token.to_owned()),
        ..Options::default()
    });
    let mut outputs = Outputs::default();
    fs::rename(
        root.path().join("mokly.config.json"),
        root.path().join("-catalogue.json"),
    )
    .unwrap();
    commit_all(root.path(), "assigned configuration");
    for rejected in [false, true] {
        if rejected {
            receiver.set_plan_status(Some(401));
        }
        let token_arg = format!("--token={token}");
        let endpoint = format!("--endpoint={}", receiver.endpoint);
        let result = mokly()
            .command(
                root.path(),
                &[
                    "publish",
                    "--no-changes",
                    "--config=-catalogue.json",
                    &token_arg,
                    &endpoint,
                    "--repository=example.com/team/site",
                ],
                "plain",
            )
            .env("MOKLY_DIAGNOSTIC", "1")
            .env("MOKLY_TOKEN", "ignored-env-token")
            .run();
        outputs.push(publication::directory(&result.stdout));
        assert_eq!(
            result.code,
            Some(if rejected { 1 } else { 0 }),
            "{}",
            result.stderr
        );
        let printed = format!("{}{}", result.stdout, result.stderr);
        assert!(!printed.contains(token));
        assert!(!printed.contains(encoded));
        if rejected {
            assert!(result.stderr.contains("[mokly/upload-unauthorized]"));
            assert!(result.stderr.contains("Diagnostic causes"));
        } else {
            assert!(result.stdout.contains("Published Mokly catalogue"));
        }
    }
    let record = receiver.record();
    assert_eq!(record.metadata[0]["configPath"], "-catalogue.json");
    assert_eq!(record.bodies.len(), 2);
    assert_eq!(record.completed, 1);
    receiver.close();
}

#[test]
fn real_publication_retries_each_retryable_status_at_plan_blob_and_complete_with_concurrency_one() {
    let root = publication::fixture(false, "sha1");
    for status in [408, 429, 500, 502, 503, 504] {
        let receiver = Exchange::start(Options {
            retry_status: Some(status),
            ..Options::default()
        });
        let result = publication::publish(
            &mokly(),
            root.path(),
            &receiver.endpoint,
            "plain",
            &["--upload-concurrency=1"],
        )
        .run();
        let mut outputs = Outputs::default();
        outputs.push(publication::directory(&result.stdout));
        assert_eq!(result.code, Some(0), "{status}: {}", result.stderr);
        let record = receiver.record();
        assert_eq!(record.bodies.len(), 2);
        assert_eq!(record.bodies[0], record.bodies[1]);
        assert!(!record.attempts.is_empty());
        assert!(record.attempts.values().all(|count| *count == 2));
        assert_eq!(record.completion_attempts, 2);
        assert_eq!(record.completed, 1);
        assert_eq!(receiver.maximum_blob_concurrency(), 1);
        receiver.close();
    }
}
