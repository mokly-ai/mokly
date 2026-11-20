//! Completion takes an empty body and renders the receipt from persisted state.

use std::sync::Arc;

use axum::body::Body;
use axum::http::StatusCode;
use chrono::{TimeZone, Utc};
use mkc_mokly_contract::error::Rejection;
use mkc_publications::error::{self, Error};
use mkc_publications::ingest::{IngestMock, Ingested};
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use serde_json::{Value, json};
use unimock::{Clause, MockFn, Unimock, matching};

use super::{Case, PROJECT, UPLOAD, authorized, params, reason, request, send, upload};
use crate::operation::Operation;

fn ingested(replay: bool) -> Ingested {
    let at = Utc.with_ymd_and_hms(2026, 9, 26, 12, 15, 0).unwrap();
    Ingested {
        publication: Publication {
            id: UPLOAD,
            project_id: PROJECT,
            metadata: None,
            state: PublicationState::Ready,
            failure: None,
            changes: Some(Changes::NoComparison),
            created_at: at,
            deadline: at,
            expired_at: None,
            build_id: None,
            build_failure_event_id: None,
        },
        organization_slug: "acme".parse().unwrap(),
        project_slug: "web".parse().unwrap(),
        replay,
    }
}

fn completing(result: fn() -> error::Result<Ingested>) -> impl Clause {
    IngestMock::complete
        .next_call(matching!(_, _))
        .answers_arc(Arc::new(move |_, authorization, upload| {
            assert_eq!(authorization.project(), PROJECT);
            assert_eq!(upload, UPLOAD);
            result()
        }))
}

async fn complete(ingest: Unimock, upload_id: String, body: &'static str) -> (StatusCode, Value) {
    let headers: &[(&str, &str)] = if body.is_empty() {
        &[]
    } else {
        &[("content-type", "application/json")]
    };
    send(
        &upload(ingest, Unimock::new(())),
        Operation::CompletePublicationUpload,
        params(&[
            ("projectId", PROJECT.0.to_string()),
            ("publicationId", upload_id),
        ]),
        request(
            "/v1/projects/p/publication-uploads/u/complete",
            headers,
            Body::from(body),
        ),
    )
    .await
}

#[tokio::test]
async fn the_attempt_that_became_ready_answers_created_with_its_receipt() {
    let ingest = Unimock::new((authorized(), completing(|| Ok(ingested(false)))));
    let (status, body) = complete(ingest, UPLOAD.0.to_string(), "").await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(
        body,
        json!({
            "id": UPLOAD.0,
            "projectId": PROJECT.0,
            "buildId": null,
            "state": "ready",
            "catalogueUrl": format!("https://p-{}.example.net", UPLOAD.0),
            "viewerUrl": format!(
                "https://app.example.com/acme/web/publications/{}?view=changes",
                UPLOAD.0
            ),
        })
    );
}

#[tokio::test]
async fn a_superseded_attempt_answers_ok_with_the_winner() {
    let ingest = Unimock::new((authorized(), completing(|| Ok(ingested(true)))));
    let (status, body) = complete(ingest, UPLOAD.0.to_string(), "").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], json!(UPLOAD.0));
}

#[tokio::test]
async fn completion_failures_keep_their_released_statuses() {
    let failures: [Case<error::Result<Ingested>>; 4] = [
        (
            || {
                Err(Error::InvalidBundle {
                    reason: Rejection::Detail,
                })
            },
            StatusCode::BAD_REQUEST,
            "upload-invalid-bundle",
        ),
        (
            || Err(Error::Incomplete),
            StatusCode::CONFLICT,
            "upload-incomplete",
        ),
        (|| Err(Error::Expired), StatusCode::GONE, "upload-expired"),
        (|| Err(Error::NotFound), StatusCode::NOT_FOUND, "not-found"),
    ];
    for (result, expected, label) in failures {
        let ingest = Unimock::new((authorized(), completing(result)));
        let (status, body) = complete(ingest, UPLOAD.0.to_string(), "").await;
        assert_eq!((status, reason(&body)), (expected, label));
    }
}

#[tokio::test]
async fn a_nonempty_body_or_malformed_attempt_never_reaches_the_service() {
    let (status, body) = complete(Unimock::new(authorized()), UPLOAD.0.to_string(), "{}").await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::BAD_REQUEST, "upload-invalid-bundle")
    );
    let (status, body) = complete(Unimock::new(authorized()), "u-1".into(), "").await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::NOT_FOUND, "not-found")
    );
}
