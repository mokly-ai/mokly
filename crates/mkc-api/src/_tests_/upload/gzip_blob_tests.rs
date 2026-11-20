//! Gzip Blob requests verify decoding, size, digest and reservation lifetimes.

use std::io::Write;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use axum::body::Body;
use axum::http::StatusCode;
use chrono::{TimeZone, Utc};
use flate2::{Compression, write::GzEncoder};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_publications::error::Error;
use mkc_publications::ingest::{BlobTarget, IngestMock};
use mkc_upload_memory_interface::budget::{UploadMemoryBudgetMock, UploadMemoryReservation};
use serde_json::Value;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use super::{Held, PROJECT, UPLOAD, authorized, params, reason, request, send, upload};
use crate::operation::Operation;

fn target_for(durable: bool, hash_body: &[u8], size: u64) -> BlobTarget {
    BlobTarget {
        project: PROJECT,
        key: BlobKey {
            hash: BlobHash::digest(hash_body),
            incarnation: Uuid::from_u128(7),
        },
        size,
        durable,
        deadline: Utc.with_ymd_and_hms(2026, 9, 26, 12, 15, 0).unwrap(),
    }
}

fn resolved_target(expected: BlobTarget) -> impl Clause {
    IngestMock::blob_target
        .next_call(matching!(_, _, _))
        .answers_arc(Arc::new(move |_, authorization, upload, hash| {
            assert_eq!(authorization.project(), PROJECT);
            assert_eq!(upload, UPLOAD);
            assert_eq!(hash, Some(&expected.key.hash));
            Ok(expected.clone())
        }))
}

fn gzip(body: &[u8]) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(body).unwrap();
    encoder.finish().unwrap()
}

fn gzip_headers(length: usize) -> [(&'static str, &'static str); 3] {
    let length = Box::leak(length.to_string().into_boxed_str());
    [
        ("content-type", "application/octet-stream"),
        ("content-encoding", "gzip"),
        ("content-length", length),
    ]
}

struct TrackedReservation(Arc<AtomicUsize>);

impl Drop for TrackedReservation {
    fn drop(&mut self) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
}

impl UploadMemoryReservation for TrackedReservation {}

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

#[tokio::test]
async fn a_gzip_blob_is_decoded_before_storage() {
    let decoded = vec![b'x'; 64];
    let encoded = gzip(&decoded);
    assert!(encoded.len() <= decoded.len());
    let target = target_for(false, &decoded, decoded.len() as u64);
    let ingest = Unimock::new((
        authorized(),
        resolved_target(target),
        IngestMock::store_blob
            .next_call(matching!(_, _))
            .answers(&|_, _, bytes| {
                assert_eq!(bytes.as_ref(), vec![b'x'; 64].as_slice());
                Ok(())
            }),
    ));
    let memory = Unimock::new(
        UploadMemoryBudgetMock::reserve
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Arc::new(Held))),
    );
    let headers = gzip_headers(encoded.len());
    let (status, body) = put(
        ingest,
        memory,
        BlobHash::digest(&decoded).as_str(),
        &headers,
        encoded,
    )
    .await;
    assert_eq!((status, body), (StatusCode::NO_CONTENT, Value::Null));
}

#[tokio::test]
async fn gzip_reservations_release_encoded_bytes_before_storage_and_decoded_bytes_after() {
    let decoded = vec![b'x'; 64];
    let encoded = gzip(&decoded);
    let target = target_for(false, &decoded, decoded.len() as u64);
    let drops = Arc::new(AtomicUsize::new(0));
    let store_drops = drops.clone();
    let ingest = Unimock::new((
        authorized(),
        resolved_target(target),
        IngestMock::store_blob
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                assert_eq!(store_drops.load(Ordering::SeqCst), 1);
                Ok(())
            })),
    ));
    let memory_drops = drops.clone();
    let memory = Unimock::new(
        UploadMemoryBudgetMock::reserve
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Arc::new(TrackedReservation(memory_drops.clone())))
            })),
    );
    let headers = gzip_headers(encoded.len());
    let (status, _) = put(
        ingest,
        memory,
        BlobHash::digest(&decoded).as_str(),
        &headers,
        encoded,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(drops.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn an_encoded_length_above_the_declared_size_is_rejected_before_reading() {
    let hash = BlobHash::digest(b"<p>catalogue</p>");
    let headers = gzip_headers(17);
    let (status, body) = put(
        Unimock::new((
            authorized(),
            resolved_target(target_for(false, b"<p>catalogue</p>", 16)),
        )),
        Unimock::new(()),
        hash.as_str(),
        &headers,
        b"body is not read".to_vec(),
    )
    .await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::BAD_REQUEST, "upload-invalid-bundle")
    );
}

#[tokio::test]
async fn a_gzip_body_that_decodes_past_the_declared_size_is_not_stored() {
    let decoded = vec![b'x'; 65];
    let encoded = gzip(&decoded);
    assert!(encoded.len() <= 64);
    let target = target_for(false, &decoded, 64);
    let headers = gzip_headers(encoded.len());
    let (status, body) = put(
        Unimock::new((authorized(), resolved_target(target))),
        Unimock::new(
            UploadMemoryBudgetMock::reserve
                .each_call(matching!(_))
                .answers(&|_, _| Ok(Arc::new(Held))),
        ),
        BlobHash::digest(&decoded).as_str(),
        &headers,
        encoded,
    )
    .await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::BAD_REQUEST, "upload-invalid-bundle")
    );
}

#[tokio::test]
async fn invalid_gzip_is_not_stored() {
    let hash = BlobHash::digest(b"<p>catalogue</p>");
    let encoded = b"not gzip".to_vec();
    let headers = gzip_headers(encoded.len());
    let (status, body) = put(
        Unimock::new((
            authorized(),
            resolved_target(target_for(false, b"<p>catalogue</p>", 16)),
        )),
        Unimock::new(
            UploadMemoryBudgetMock::reserve
                .each_call(matching!(_))
                .answers(&|_, _| Ok(Arc::new(Held))),
        ),
        hash.as_str(),
        &headers,
        encoded,
    )
    .await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::BAD_REQUEST, "upload-invalid-bundle")
    );
}

#[tokio::test]
async fn a_decoded_digest_mismatch_is_reported_without_storage() {
    let expected = vec![b'e'; 64];
    let actual = vec![b'w'; 64];
    let encoded = gzip(&actual);
    assert!(encoded.len() <= expected.len());
    let target = target_for(false, &expected, expected.len() as u64);
    let headers = gzip_headers(encoded.len());
    let ingest = Unimock::new((
        authorized(),
        resolved_target(target),
        IngestMock::store_blob
            .next_call(matching!(_, _))
            .answers(&|_, _, _| Err(Error::BlobMismatch)),
    ));
    let (status, body) = put(
        ingest,
        Unimock::new(
            UploadMemoryBudgetMock::reserve
                .each_call(matching!(_))
                .answers(&|_, _| Ok(Arc::new(Held))),
        ),
        BlobHash::digest(&expected).as_str(),
        &headers,
        encoded,
    )
    .await;
    assert_eq!(
        (status, reason(&body)),
        (StatusCode::BAD_REQUEST, "upload-blob-mismatch")
    );
}

#[tokio::test]
async fn a_durable_gzip_blob_is_drained_without_storage() {
    let decoded = vec![b'x'; 64];
    let encoded = gzip(&decoded);
    assert!(encoded.len() <= decoded.len());
    let target = target_for(true, &decoded, decoded.len() as u64);
    let headers = gzip_headers(encoded.len());
    let (status, _) = put(
        Unimock::new((authorized(), resolved_target(target))),
        Unimock::new(()),
        BlobHash::digest(&decoded).as_str(),
        &headers,
        encoded,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}
