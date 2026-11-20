//! Plan requests stream the archive into preflight and answer the released document.

use std::sync::Arc;

use axum::body::Body;
use axum::http::StatusCode;
use chrono::{TimeZone, Utc};
use mkc_mokly_contract::error::{ArtifactKind, Limit, Rejection};
use mkc_publications::error::Error;
use mkc_publications::ingest::{IngestMock, Plan};
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use super::{Case, ORIGIN, PROJECT, UPLOAD, authorized, params, reason, request, send, upload};
use crate::operation::Operation;
use crate::upload_plan::plan_response;

const FIXTURE: &str = include_str!("../../../../mkc-mokly-contract/fixtures/upload-plan-v1.json");

fn released(case: &str) -> Value {
    let fixture: Value = serde_json::from_str(FIXTURE).unwrap();
    let document = fixture["cases"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["name"] == case)
        .unwrap()["document"]
        .to_string()
        .replace("p-123", &PROJECT.0.to_string())
        .replace("u-1", &UPLOAD.0.to_string());
    serde_json::from_str(&document).unwrap()
}

fn plan(missing: &[&str]) -> Plan {
    Plan {
        upload: UPLOAD,
        project: PROJECT,
        expires_at: Utc.with_ymd_and_hms(2026, 9, 26, 12, 15, 0).unwrap(),
        missing: missing.iter().map(|hash| hash.parse().unwrap()).collect(),
    }
}

fn marker() -> Vec<String> {
    let fixture: Value = serde_json::from_str(FIXTURE).unwrap();
    fixture["marker"]
        .as_array()
        .unwrap()
        .iter()
        .map(|hash| hash.as_str().unwrap().to_owned())
        .collect()
}

#[test]
fn rendered_plans_equal_the_released_documents() {
    let marker = marker();
    for (case, missing) in [
        ("two-missing-digests", &marker[..2]),
        ("empty-missing", &marker[..0]),
        ("every-digest-missing", &marker[..]),
    ] {
        let missing: Vec<&str> = missing.iter().map(String::as_str).collect();
        let rendered = serde_json::to_value(plan_response(ORIGIN, plan(&missing), false)).unwrap();
        assert_eq!(rendered, released(case), "{case}");
    }
}

#[test]
fn enabled_plans_advertise_only_gzip_blob_encoding() {
    let rendered = serde_json::to_value(plan_response(ORIGIN, plan(&[]), true)).unwrap();
    assert_eq!(rendered["blobEncodings"], serde_json::json!(["gzip"]));
    assert_eq!(rendered.as_object().unwrap().len(), 6);
}

#[test]
fn deadlines_keep_exactly_three_fractional_digits_in_utc() {
    let mut value = plan(&[]);
    value.expires_at = Utc
        .timestamp_opt(1_790_000_000, 123_456_789)
        .single()
        .unwrap();
    let rendered = plan_response(ORIGIN, value, false);
    assert_eq!(rendered.upload.expires_at, "2026-09-21T14:13:20.123Z");
}

#[tokio::test]
async fn a_plan_streams_the_archive_and_answers_with_its_urls() {
    let ingest = Unimock::new((
        authorized(),
        IngestMock::preflight
            .next_call(matching!(_, _))
            .answers(&|_, authorization, body| {
                assert_eq!(authorization.project(), PROJECT);
                let mut bytes = Vec::new();
                body.read_to_end(&mut bytes).unwrap();
                assert_eq!(bytes, b"plan archive");
                Ok(plan(&[]))
            }),
    ));
    let (status, body) = send(
        &upload(ingest, Unimock::new(())),
        Operation::UploadPublication,
        params(&[("projectId", PROJECT.0.to_string())]),
        request(
            "/v1/projects/p/publications",
            &[("content-type", "application/gzip")],
            Body::from("plan archive"),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, released("empty-missing"));
}

#[tokio::test]
async fn plan_failures_keep_their_released_statuses() {
    let failures: [Case<Error>; 3] = [
        (
            || Error::UnsupportedVersion {
                artifact: ArtifactKind::Inventory,
                version: Some(1),
            },
            StatusCode::UPGRADE_REQUIRED,
            "upload-unsupported-version",
        ),
        (
            || Error::InvalidBundle {
                reason: Rejection::Gzip,
            },
            StatusCode::BAD_REQUEST,
            "upload-invalid-bundle",
        ),
        (
            || Error::TooLarge {
                limit: Limit::FileCount,
            },
            StatusCode::PAYLOAD_TOO_LARGE,
            "upload-too-large",
        ),
    ];
    for (error, expected, label) in failures {
        let ingest = Unimock::new((
            authorized(),
            IngestMock::preflight
                .next_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| Err(error()))),
        ));
        let (status, body) = send(
            &upload(ingest, Unimock::new(())),
            Operation::UploadPublication,
            params(&[("projectId", PROJECT.0.to_string())]),
            request(
                "/v1/projects/p/publications",
                &[("content-type", "application/gzip")],
                Body::from("plan archive"),
            ),
        )
        .await;
        assert_eq!((status, reason(&body)), (expected, label));
        if expected == StatusCode::UPGRADE_REQUIRED {
            assert_eq!(
                body["error"]["message"],
                "Update Mokly to 0.18.0 and publish again."
            );
            assert!(body["error"].get("data").is_none());
        }
    }
}

#[tokio::test]
async fn the_bearer_and_media_type_are_checked_before_the_body() {
    let (status, body) = send(
        &upload(Unimock::new(()), Unimock::new(())),
        Operation::UploadPublication,
        params(&[("projectId", PROJECT.0.to_string())]),
        axum::http::Request::builder()
            .method("POST")
            .uri("/v1/projects/p/publications")
            .header("content-type", "application/gzip")
            .body(Body::from("plan archive"))
            .unwrap(),
    )
    .await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::UNAUTHORIZED, "upload-unauthorized")
    );
    let (status, body) = send(
        &upload(Unimock::new(authorized()), Unimock::new(())),
        Operation::UploadPublication,
        params(&[("projectId", PROJECT.0.to_string())]),
        request(
            "/v1/projects/p/publications",
            &[("content-type", "application/octet-stream")],
            Body::from("plan archive"),
        ),
    )
    .await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::BAD_REQUEST, "upload-invalid-bundle")
    );
}
