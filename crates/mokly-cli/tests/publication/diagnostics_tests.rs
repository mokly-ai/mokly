//! Timing records, redacted diagnostic causes, an older receiver, and reserved inspector metadata.

use mokly_test_support::files::write;
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::receiver::{Exchange, Options};
use mokly_test_support::timings::timings;
use regex::Regex;

use super::support::mokly;

#[test]
fn timings_preserve_plain_output_and_diagnostic_causes_redact_credentials() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let receiver = Exchange::start(Options::default());
    let mut outputs = Outputs::default();
    let built = mokly()
        .command(path, &["build", "--no-changes", "--debug-timings"], "rich")
        .run();
    assert_eq!(built.code, Some(0), "{}", built.stderr);
    assert!(built.stdout.starts_with("Built Mokly to"));
    let result = publication::publish(
        &mokly(),
        path,
        &receiver.endpoint,
        "rich",
        &["--debug-timings"],
    )
    .run();
    outputs.push(publication::directory(&result.stdout));
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    for output in [&built, &result] {
        let records = timings(&output.stderr);
        assert!(records.iter().any(|record| record.stage() == "config.load"));
        assert!(
            records
                .iter()
                .any(|record| record.stage() == "output.install" && record.event() == "end")
        );
        assert!(
            records
                .iter()
                .any(|record| record.stage() == "render.document" && record.parent_id().is_some())
        );
        assert!(!output.stdout.contains('✔'));
    }
    assert!(result.stderr.contains(r#""stage":"upload.plan""#));
    let bad_base = mokly()
        .command(
            path,
            &["build", "--base=absent-base", "--debug-timings"],
            "plain",
        )
        .run();
    assert_eq!(bad_base.code, Some(1));
    assert!(timings(&bad_base.stderr).iter().any(|record| {
        record.stage() == "review.base-commit"
            && record.event() == "end"
            && record.status() == Some("error")
    }));
    write(path, "mokly.config.json", r#"{"private/a==":true}"#);
    let failure = mokly()
        .command(path, &["build", "--no-changes"], "plain")
        .env("MOKLY_DIAGNOSTIC", "1")
        .env("MOKLY_TOKEN", TOKEN)
        .run();
    assert_eq!(failure.code, Some(1));
    assert!(failure.stderr.contains("Diagnostic causes:"));
    assert!(failure.stderr.contains("[redacted]"));
    assert!(!failure.stderr.contains(TOKEN));
    receiver.close();
}

#[test]
fn an_older_receiver_fails_the_real_publication_with_426_and_retains_the_build() {
    let root = publication::fixture(false, "sha1");
    let receiver = Exchange::start(Options {
        plan_status: Some(426),
        ..Options::default()
    });
    let result = publication::publish(&mokly(), root.path(), &receiver.endpoint, "plain", &[])
        .env("MOKLY_DIAGNOSTIC", "1")
        .run();
    let output = publication::directory(&result.stdout);
    let mut outputs = Outputs::default();
    outputs.push(output.clone());
    assert_eq!(result.code, Some(1));
    assert!(result.stderr.contains("[mokly/upload-unsupported-version]"));
    assert!(result.stderr.contains("Diagnostic causes:"));
    assert!(!result.stderr.contains(TOKEN));
    let record = receiver.record();
    assert_eq!(record.bodies.len(), 1);
    assert!(record.attempts.is_empty());
    assert_eq!(record.completed, 0);
    assert!(output.join(".mokly-export-artifact").is_file());
    receiver.close();
}

#[test]
fn consumer_inspector_metadata_fails_with_its_document_route_and_build_category() {
    let root = publication::fixture(false, "sha1");
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<a href=\"#home\" data-mokly-inspector-link=\"0\">Home</a><h1 id=\"home\">Home</h1>",
    );
    let result = mokly()
        .command(root.path(), &["build", "--no-changes"], "plain")
        .run();
    assert_eq!(result.code, Some(1));
    let reserved = Regex::new(
        r"\[mokly/build-invalid\] home/index\.(desktop|mobile)\.html: data-mokly-inspector-link is reserved",
    )
    .unwrap();
    assert!(reserved.is_match(&result.stderr), "{}", result.stderr);
    assert!(!result.stderr.contains("[mokly-static"));
}
