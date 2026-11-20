//! Blob PUTs check the reservation before reading and buffer within the byte budget.

use std::sync::Arc;

use axum::body::Body;
use axum::http::StatusCode;
use chrono::{TimeZone, Utc};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_publications::error::Error;
use mkc_publications::ingest::{BlobTarget, IngestMock};
use mkc_upload_memory_interface::budget::{self, UploadMemoryBudgetMock};
use serde_json::Value;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use super::{Case, Held, PROJECT, UPLOAD, authorized, params, reason, request, send, upload};
use crate::operation::Operation;

const BODY: &[u8] = b"<p>catalogue</p>";

fn target(durable: bool) -> BlobTarget {
    BlobTarget {
        project: PROJECT,
        key: BlobKey {
            hash: BlobHash::digest(BODY),
            incarnation: Uuid::from_u128(7),
        },
        size: BODY.len() as u64,
        durable,
        deadline: Utc.with_ymd_and_hms(2026, 9, 26, 12, 15, 0).unwrap(),
    }
}

fn resolved(durable: bool) -> impl Clause {
    IngestMock::blob_target
        .next_call(matching!(_, _, _))
        .answers_arc(Arc::new(move |_, authorization, upload, hash| {
            assert_eq!(authorization.project(), PROJECT);
            assert_eq!(upload, UPLOAD);
            assert_eq!(hash, Some(&BlobHash::digest(BODY)));
            Ok(target(durable))
        }))
}

fn reserving() -> impl Clause {
    UploadMemoryBudgetMock::reserve
        .next_call(matching!(16))
        .answers(&|_, _| Ok(Arc::new(Held)))
}

async fn put(
    ingest: Unimock,
    memory: Unimock,
    sha256: &str,
    headers: &[(&str, &str)],
    body: impl Into<Body>,
) -> (StatusCode, Value) {
    send(
        &upload(ingest, memory),
        Operation::UploadPublicationBlob,
        params(&[
            ("projectId", PROJECT.0.to_string()),
            ("publicationId", UPLOAD.0.to_string()),
            ("sha256", sha256.to_owned()),
        ]),
        request(
            "/v1/projects/p/publication-uploads/u/blobs/h",
            headers,
            body.into(),
        ),
    )
    .await
}

fn raw(length: &'static str) -> [(&'static str, &'static str); 2] {
    [
        ("content-type", "application/octet-stream"),
        ("content-length", length),
    ]
}

#[tokio::test]
async fn a_missing_blob_is_buffered_within_the_budget_and_stored() {
    let ingest = Unimock::new((
        authorized(),
        resolved(false),
        IngestMock::store_blob
            .next_call(matching!(_, _))
            .answers(&|_, target, bytes| {
                assert_eq!(target.key.hash, BlobHash::digest(BODY));
                assert_eq!(bytes.as_ref(), BODY);
                Ok(())
            }),
    ));
    let hash = BlobHash::digest(BODY);
    let (status, body) = put(
        ingest,
        Unimock::new(reserving()),
        hash.as_str(),
        &raw("16"),
        BODY,
    )
    .await;
    assert_eq!((status, body), (StatusCode::NO_CONTENT, Value::Null));
}

#[tokio::test]
async fn a_durable_blob_answers_without_buffering_or_storing() {
    let ingest = Unimock::new((authorized(), resolved(true)));
    let hash = BlobHash::digest(BODY);
    let (status, _) = put(ingest, Unimock::new(()), hash.as_str(), &raw("16"), BODY).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn headers_are_checked_before_the_reservation() {
    let hash = BlobHash::digest(BODY);
    for (headers, expected, label) in [
        (
            &[
                ("content-type", "application/gzip"),
                ("content-length", "16"),
            ][..],
            StatusCode::BAD_REQUEST,
            "upload-invalid-bundle",
        ),
        (
            &[
                ("content-type", "application/octet-stream"),
                ("content-encoding", "br"),
                ("content-length", "16"),
            ][..],
            StatusCode::BAD_REQUEST,
            "upload-invalid-bundle",
        ),
        (
            &[("content-type", "application/octet-stream")][..],
            StatusCode::BAD_REQUEST,
            "upload-invalid-bundle",
        ),
        (
            &raw("67108865")[..],
            StatusCode::PAYLOAD_TOO_LARGE,
            "upload-too-large",
        ),
    ] {
        let (status, body) = put(
            Unimock::new(authorized()),
            Unimock::new(()),
            hash.as_str(),
            headers,
            BODY,
        )
        .await;
        assert_eq!((status, reason(&body)), (expected, label));
    }
}

#[tokio::test]
async fn a_declared_length_other_than_the_reserved_size_is_a_mismatch() {
    let ingest = Unimock::new((authorized(), resolved(false)));
    let hash = BlobHash::digest(BODY);
    let (status, body) = put(ingest, Unimock::new(()), hash.as_str(), &raw("15"), BODY).await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::BAD_REQUEST, "upload-blob-mismatch")
    );
}

#[tokio::test]
async fn a_path_segment_that_is_not_a_digest_reaches_the_attempt_checks() {
    let ingest = Unimock::new((
        authorized(),
        IngestMock::blob_target
            .next_call(matching!(_, _, None))
            .answers(&|_, _, _, _| Err(Error::NotFound)),
    ));
    let (status, body) = put(ingest, Unimock::new(()), "NOT-A-DIGEST", &raw("16"), BODY).await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::NOT_FOUND, "not-found")
    );
}

#[tokio::test]
async fn reservation_failures_keep_their_released_statuses() {
    let failures: [Case<Error>; 4] = [
        (|| Error::NotFound, StatusCode::NOT_FOUND, "not-found"),
        (|| Error::Expired, StatusCode::GONE, "upload-expired"),
        (
            || Error::UnknownBlob,
            StatusCode::NOT_FOUND,
            "upload-unknown-blob",
        ),
        (
            || Error::Unavailable,
            StatusCode::SERVICE_UNAVAILABLE,
            "upload-unavailable",
        ),
    ];
    let hash = BlobHash::digest(BODY);
    for (error, expected, label) in failures {
        let ingest = Unimock::new((
            authorized(),
            IngestMock::blob_target
                .next_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, _, _| Err(error()))),
        ));
        let (status, body) = put(ingest, Unimock::new(()), hash.as_str(), &raw("16"), BODY).await;
        assert_eq!((status, reason(&body)), (expected, label));
    }
}

#[tokio::test]
async fn an_exhausted_budget_is_retryable_and_reads_nothing() {
    let ingest = Unimock::new((authorized(), resolved(false)));
    let memory = Unimock::new(
        UploadMemoryBudgetMock::reserve
            .next_call(matching!(16))
            .answers(&|_, _| {
                Err(budget::Error::Exhausted {
                    requested: 16,
                    capacity: 8,
                })
            }),
    );
    let hash = BlobHash::digest(BODY);
    let (status, body) = put(ingest, memory, hash.as_str(), &raw("16"), BODY).await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::SERVICE_UNAVAILABLE, "upload-unavailable")
    );
}

#[tokio::test]
async fn a_body_that_disagrees_with_its_length_is_invalid() {
    let hash = BlobHash::digest(BODY);
    for body in [b"<p>short</p>".as_slice(), b"<p>catalogue</p> and more"] {
        let ingest = Unimock::new((authorized(), resolved(false)));
        let (status, rendered) = put(
            ingest,
            Unimock::new(reserving()),
            hash.as_str(),
            &raw("16"),
            body,
        )
        .await;
        assert_eq!(
            (status, reason(&rendered)),
            (StatusCode::BAD_REQUEST, "upload-invalid-bundle")
        );
    }
}

#[tokio::test]
async fn a_digest_mismatch_found_while_storing_is_reported() {
    let ingest = Unimock::new((
        authorized(),
        resolved(false),
        IngestMock::store_blob
            .next_call(matching!(_, _))
            .answers(&|_, _, _| Err(Error::BlobMismatch)),
    ));
    let hash = BlobHash::digest(BODY);
    let (status, body) = put(
        ingest,
        Unimock::new(reserving()),
        hash.as_str(),
        &raw("16"),
        BODY,
    )
    .await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::BAD_REQUEST, "upload-blob-mismatch")
    );
}
