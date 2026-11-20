//! Run identity is validated before any seed result can be written.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde_json::json;

use crate::preview_seed::error::{Error, Failure};
use crate::preview_seed::request::Request;

#[test]
fn validates_version_environment_pull_request_and_exact_revision() {
    let base = json!({ "schemaVersion": 1, "environment": "preview-pr-123",
        "revision": "1111111111111111111111111111111111111111", "pullRequest": 123 });
    let parsed = Request::parse(&serde_json::to_vec(&base).unwrap());
    assert!(parsed.is_ok(), "valid preview request failed: {parsed:?}");
    let parsed = parsed.unwrap();
    assert_eq!(parsed.environment, "preview-pr-123");
    assert_eq!(parsed.pull_request, Some(123));
    for (field, value) in [
        ("schemaVersion", json!(2)),
        ("environment", json!("preview-pr-0")),
        ("environment", json!("preview-pr-0123")),
        ("environment", json!("preview-pr-1000000000")),
        ("environment", json!("production")),
        ("environment", json!("local")),
        ("pullRequest", json!(124)),
        ("pullRequest", json!(null)),
        ("pullRequest", json!(123.0)),
        (
            "revision",
            json!("A111111111111111111111111111111111111111"),
        ),
        ("revision", json!("111111111111111111111111111111111111111")),
    ] {
        let mut invalid = base.clone();
        invalid[field] = value;
        assert!(
            matches!(
                Request::parse(&serde_json::to_vec(&invalid).unwrap()),
                Err(Error::Internal(_))
            ),
            "accepted {invalid}"
        );
    }
    let local = json!({"schemaVersion":1,"environment":"local",
        "revision":"1111111111111111111111111111111111111111","pullRequest":null});
    assert!(Request::parse(&serde_json::to_vec(&local).unwrap()).is_ok());
    let mut missing = local;
    missing.as_object_mut().unwrap().remove("pullRequest");
    assert!(matches!(
        Request::parse(&serde_json::to_vec(&missing).unwrap()),
        Err(Error::Internal(_))
    ));
}

#[test]
fn development_skips_only_the_compiled_revision_comparison() {
    let request = Request {
        schema_version: 1,
        environment: "local".to_owned(),
        pull_request: None,
        revision: "1111111111111111111111111111111111111111".to_owned(),
    };
    assert!(request.verify_revision("development").is_ok());
    assert!(
        request
            .verify_revision("1111111111111111111111111111111111111111")
            .is_ok()
    );
    let mismatch = request.verify_revision("2222222222222222222222222222222222222222");
    let Error::Internal(error) = mismatch.unwrap_err() else {
        panic!("unexpected revision error");
    };
    let cause = error
        .source_chain()
        .find_map(|cause| cause.downcast_ref::<Failure>());
    assert!(
        matches!(cause, Some(Failure::Mismatch { field: "build revision", expected, received })
        if expected == "2222222222222222222222222222222222222222"
            && received == "1111111111111111111111111111111111111111")
    );
}
