//! Typed plan and blob refusals retain no mismatched identity and permit a valid retry.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration as StdDuration;

use chrono::{Duration, Utc};
use mkc_store_interface::build_state::UploadOutcome;
use mkc_store_interface::publication::PublicationFailure;
use reqwest::Method;
use serde_json::json;
use uuid::Uuid;

use super::super::harness::{Harness, json as response_json};
use super::support::{
    blob, catalogue, catalogue_with, complete, outcome, plan, refusal, send_blobs, start, upload_id,
};

#[test]
fn envelope_mismatches_never_retain_identity_and_a_rejected_plan_can_retry() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let mut attempt = start(&app, &project, 60, Duration::zero(), Some(42));
    let original_head = attempt.head.clone();
    attempt.head = "f".repeat(40);
    refusal(
        plan(&app, &attempt, catalogue(&attempt, None).plan),
        403,
        "upload-forbidden",
        &attempt.bearer,
    );
    attempt.head = original_head;
    let original_branch = attempt.branch.clone();
    attempt.branch = "another-branch".into();
    refusal(
        plan(&app, &attempt, catalogue(&attempt, None).plan),
        403,
        "upload-forbidden",
        &attempt.bearer,
    );
    attempt.branch = original_branch;
    refusal(
        plan(&app, &attempt, catalogue(&attempt, Some(43)).plan),
        403,
        "upload-forbidden",
        &attempt.bearer,
    );
    app.queries(&mut |queries| {
        let rows = queries.publications(project.id)?;
        assert_eq!(rows.len(), 3);
        assert!(
            rows.iter()
                .all(|row| row.build_id == Some(attempt.id) && row.metadata.is_none())
        );
        Ok(())
    });
    refusal(
        plan(&app, &attempt, b"invalid gzip".to_vec()),
        400,
        "upload-invalid-bundle",
        &attempt.bearer,
    );
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::Rejected));
    let catalogue = catalogue(&attempt, Some(42));
    let planned = response_json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    send_blobs(&app, &attempt, &planned, &catalogue);
    response_json(complete(&app, &attempt, upload_id(&planned)), 201);
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::Accepted));
}

#[test]
fn blob_rejections_and_expiry_do_not_overwrite_a_higher_ranked_outcome() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let attempt = start(&app, &project, 70, Duration::zero(), None);
    let catalogue = catalogue(&attempt, None);
    let planned = response_json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    let id = upload_id(&planned);
    let hash = planned["missing"][0].as_str().unwrap();
    let mut bytes = catalogue.blobs[hash].clone();
    if let Some(byte) = bytes.first_mut() {
        *byte ^= 1;
    } else {
        bytes.push(1);
    }
    refusal(
        blob(&app, &attempt, id, hash, bytes),
        400,
        "upload-blob-mismatch",
        &attempt.bearer,
    );
    refusal(
        blob(
            &app,
            &attempt,
            id,
            hash,
            vec![1; catalogue.blobs[hash].len() + 1],
        ),
        400,
        "upload-blob-mismatch",
        &attempt.bearer,
    );
    refusal(
        blob(&app, &attempt, id, "bad-hash", vec![1]),
        404,
        "upload-unknown-blob",
        &attempt.bearer,
    );
    refusal(
        blob(&app, &attempt, Uuid::now_v7().into(), hash, vec![1]),
        404,
        "not-found",
        &attempt.bearer,
    );
    refusal(
        complete(&app, &attempt, id),
        409,
        "upload-incomplete",
        &attempt.bearer,
    );
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::Rejected));
    app.queries(&mut |queries| {
        assert!(queries.fail_publication(id, PublicationFailure::Expired)?);
        queries.delete_publication_files(id)?;
        assert!(
            queries
                .build_attempt_grant(attempt.id, 1)?
                .unwrap()
                .consumed_at
                .is_none()
        );
        Ok(())
    });
    refusal(
        complete(&app, &attempt, id),
        410,
        "upload-expired",
        &attempt.bearer,
    );
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::Rejected));
    let planned = response_json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    send_blobs(&app, &attempt, &planned, &catalogue);
    response_json(complete(&app, &attempt, upload_id(&planned)), 201);
}

#[test]
fn another_builds_attempt_in_the_same_project_stays_not_found() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let owner = start(&app, &project, 80, Duration::zero(), None);
    let other = start(&app, &project, 81, Duration::zero(), None);
    let catalogue = catalogue(&owner, None);
    let planned = response_json(plan(&app, &owner, catalogue.plan), 200);
    let id = upload_id(&planned);
    refusal(
        blob(
            &app,
            &other,
            id,
            planned["missing"][0].as_str().unwrap(),
            vec![1],
        ),
        404,
        "not-found",
        &other.bearer,
    );
    refusal(complete(&app, &other, id), 404, "not-found", &other.bearer);
    app.queries(&mut |queries| {
        assert!(
            queries
                .cancel_build(project.id, owner.id, Utc::now())?
                .is_some()
        );
        Ok(())
    });
    let receipts = response_json(
        app.request(
            Method::GET,
            &format!("/v1/projects/{}/publications", project.id),
        )
        .send()
        .unwrap(),
        200,
    );
    assert_eq!(receipts["items"], json!([]));
}

#[test]
fn build_plans_preserve_version_size_media_repository_and_config_rejections() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let attempt = start(&app, &project, 90, Duration::zero(), None);
    for (patch, status, reason) in [
        (r#"{"schemaVersion":1}"#, 426, "upload-unsupported-version"),
        (r#"{"markerVersion":2}"#, 426, "upload-unsupported-version"),
        (r#"{"markerVersion":99}"#, 426, "upload-unsupported-version"),
        (
            r#"{"configPath":"another.config.json"}"#,
            403,
            "upload-forbidden",
        ),
        (
            r#"{"repository":{"host":"github.com","owner":"other","name":"repository"}}"#,
            403,
            "upload-forbidden",
        ),
    ] {
        refusal(
            plan(&app, &attempt, catalogue_with(&attempt, None, patch).plan),
            status,
            reason,
            &attempt.bearer,
        );
    }
    let path = format!("/v1/projects/{}/publications", project.id);
    let mut connection = TcpStream::connect(app.origin.strip_prefix("http://").unwrap()).unwrap();
    connection
        .set_read_timeout(Some(StdDuration::from_secs(10)))
        .unwrap();
    connection.write_all(format!("POST {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nAuthorization: Bearer {}\r\nContent-Type: application/gzip\r\nContent-Length: 104857601\r\n\r\n", attempt.bearer).as_bytes()).unwrap();
    let mut response = String::new();
    connection.read_to_string(&mut response).unwrap();
    assert!(response.starts_with("HTTP/1.1 413"), "{response}");
    assert!(response.contains("upload-too-large"));
    assert!(!response.contains(&attempt.bearer));
    let response = app
        .request(Method::POST, &path)
        .bearer_auth(&attempt.bearer)
        .header("content-type", "application/json")
        .body(vec![1])
        .send()
        .unwrap();
    refusal(response, 400, "upload-invalid-bundle", &attempt.bearer);
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::Rejected));
}
