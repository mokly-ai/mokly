//! Public compatibility fixtures exercise the client-side protocol validators.

use mokly_model::output::error::FormatError;
use mokly_model::output::ownership::Ownership;
use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::{Value, json};

use crate::completion::{Completion, Outcome, retryable};
use crate::error::Error;
use crate::http::{Body, Response};
use crate::plan::Plan;
use crate::settings::Settings;

use super::support::response;

#[derive(Deserialize)]
struct OwnershipFixture {
    cases: Vec<OwnershipCase>,
}
#[derive(Deserialize)]
struct OwnershipCase {
    name: String,
    valid: bool,
    document: Box<RawValue>,
    rejection: Option<String>,
}

#[test]
fn every_public_ownership_fixture_has_the_documented_classification() {
    let fixture: OwnershipFixture = serde_json::from_str(include_str!(
        "../../../../docs/protocol/fixtures/export-ownership-v3.json"
    ))
    .unwrap();
    assert_eq!(fixture.cases.len(), 57);
    for case in fixture.cases {
        let result = Ownership::parse(case.document.get().as_bytes());
        if case.valid {
            assert!(result.is_ok(), "{}: {result:?}", case.name);
        } else {
            let classification = match result.unwrap_err() {
                FormatError::InvalidBundle => "invalid",
                FormatError::TooLarge => "too-large",
                FormatError::UnsupportedVersion => "unsupported-version",
                error => panic!("{error}"),
            };
            assert_eq!(
                Some(classification),
                case.rejection.as_deref(),
                "{}",
                case.name
            );
        }
    }
}

#[test]
fn every_plan_and_completion_fixture_matches_the_client_contract() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../../../docs/protocol/fixtures/upload-plan-v1.json"
    ))
    .unwrap();
    let settings = Settings::new(
        fixture["endpoint"].as_str().unwrap(),
        "secret".to_owned(),
        8,
    )
    .unwrap();
    let digests = fixture["marker"]
        .as_array()
        .unwrap()
        .iter()
        .map(|value| value.as_str().unwrap().to_owned())
        .collect();
    let cases = fixture["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 74);
    for case in cases {
        let status = case["status"].as_u64().unwrap_or(200) as u16;
        let content_type = case
            .get("contentType")
            .unwrap_or(&json!("application/json"))
            .as_str()
            .map(str::to_owned);
        let body = match case["body"].as_str() {
            Some(body) => body.as_bytes().to_vec(),
            None => serde_json::to_vec(&case["document"]).unwrap(),
        };
        let response = Response {
            status,
            content_type,
            body: Body::Bytes(body.into()),
            ..response(status)
        };
        if case["step"] == "complete" {
            assert_eq!(
                completion_outcome(&response, &settings),
                case["outcome"].as_str().unwrap(),
                "{}",
                case["name"]
            );
            let result = Completion::parse(&response, &settings.token);
            if case["valid"] == true {
                let completed = result.unwrap();
                assert_eq!(
                    completed.viewer_url.as_deref(),
                    case["viewerUrl"].as_str(),
                    "{}",
                    case["name"]
                );
                assert_eq!(
                    completed.outcome,
                    if case["outcome"] == "published" {
                        Outcome::Published
                    } else {
                        Outcome::AlreadyPublished
                    }
                );
            } else if case["outcome"] == "retry" {
                assert!(retryable(status));
            } else {
                assert!(result.is_err(), "{}", case["name"]);
            }
        } else {
            let result = Plan::parse(&response, &settings, &digests);
            assert_eq!(
                result.is_ok(),
                case["valid"] == true,
                "{}: {result:?}",
                case["name"]
            );
        }
    }
}

#[test]
fn duplicate_keys_invalid_unicode_bom_and_type_precedence_are_rejected() {
    for input in [
        br#"{"schemaVersion":3,"schemaVersion":3,"files":[]}"#.as_slice(),
        br#"{"schemaVersion":3,"files":[{"path":"a","path":"b","sha256":"bad","size":0}]}"#
            .as_slice(),
        b"\xef\xbb\xbf{}",
    ] {
        assert!(matches!(
            Ownership::parse(input),
            Err(FormatError::InvalidBundle)
        ));
    }
    assert!(matches!(
        Ownership::parse(br#"{"schemaVersion":9,"files":null}"#),
        Err(FormatError::UnsupportedVersion)
    ));
    assert!(matches!(
        Ownership::parse(
            br#"{"schemaVersion":3,"files":[{"path":1,"sha256":"bad","size":999999999}]}"#
        ),
        Err(FormatError::InvalidBundle)
    ));
}

fn completion_outcome(response: &Response, settings: &Settings) -> &'static str {
    if retryable(response.status) {
        return "retry";
    }
    match Completion::parse(response, settings.token()) {
        Ok(completed) => match completed.outcome {
            Outcome::Published => "published",
            Outcome::AlreadyPublished => "already-published",
        },
        Err(Error::Replan) => "replan",
        Err(Error::Unauthorized) => "upload-unauthorized",
        Err(Error::InvalidBundle) => "upload-invalid-bundle",
        Err(Error::UnsupportedVersion) => "upload-unsupported-version",
        Err(Error::TooLarge) => "upload-too-large",
        Err(Error::Failed) => "upload-failed",
        result => panic!("unexpected completion result: {result:?}"),
    }
}
