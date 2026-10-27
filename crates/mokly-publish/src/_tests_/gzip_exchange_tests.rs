//! Gzip Blob exchange tests with captured requests and fake timing.

use std::io::Read;
use std::sync::{Arc, Mutex};

use bytes::Bytes;
use flate2::read::GzDecoder;
use mokly_model::output::artifact::Artifact;
use mokly_model::output::validation::{MANIFEST, MARKER, digest};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::accounting::Progress;
use crate::completion::Outcome;
use crate::error::Error;
use crate::exchange::{Client, Exchange};
use crate::http::{Encoding, HttpMock, Step};
use crate::runtime::{CancellationMock, ClockMock, ReporterMock};
use crate::snapshot::Prepared;

use super::support::{active, artifact, file, inventory, publication, response, settings};

fn prepared_with_file(path: &str, bytes: Bytes) -> Prepared {
    let base = artifact(false);
    let files = base
        .files
        .into_iter()
        .filter(|file| file.path != MANIFEST && file.path != MARKER)
        .chain(std::iter::once(file(path, &bytes)))
        .collect();
    let artifact = Artifact::finalize(
        base.directory,
        files,
        Some(publication().metadata(&inventory(false)).unwrap()),
    )
    .unwrap();
    Prepared::new(&artifact).unwrap()
}

fn plan_response(
    expected_digest: &str,
    encodings: Option<serde_json::Value>,
) -> crate::http::Response {
    let mut document = json!({
        "schemaVersion": 1,
        "upload": {"id": "upload-1", "expiresAt": "2026-09-26T13:00:00.000Z"},
        "missing": [expected_digest],
        "blobUrl": "https://api.example.com/blobs/{sha256}",
        "completeUrl": "https://api.example.com/complete"
    });
    if let Some(encodings) = encodings {
        document["blobEncodings"] = encodings;
    }
    crate::http::Response {
        body: crate::http::Body::Bytes(serde_json::to_vec(&document).unwrap().into()),
        ..response(200)
    }
}

fn client(http: Unimock, reporter: Arc<Unimock>, clock: Arc<Unimock>) -> Client {
    Client {
        http: Arc::new(http),
        clock,
        reporter,
    }
}

fn clock_with_retry() -> Unimock {
    Unimock::new((
        ClockMock::now
            .each_call(matching!())
            .returns(1_790_424_000_000_i64),
        ClockMock::jitter.each_call(matching!(_)).returns(0_u64),
        ClockMock::sleep
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Box::pin(async {})),
    ))
}

#[tokio::test]
async fn gzip_blob_is_smaller_decodes_and_counts_decoded_bytes() {
    let prepared = prepared_with_file("static/compressible.bin", vec![b'a'; 8192].into());
    let expected_digest = prepared
        .ownership
        .files
        .iter()
        .find(|entry| entry.path == "static/compressible.bin")
        .unwrap()
        .sha256
        .clone();
    let captured = Arc::new(Mutex::new(Vec::new()));
    let observed = Arc::clone(&captured);
    let planned = plan_response(&expected_digest, Some(json!(["gzip"])));
    let http = Unimock::new((
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = planned.clone();
                Box::pin(async { Ok(response) })
            })),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Blob))
            .answers_arc(Arc::new(move |_, request, _| {
                observed
                    .lock()
                    .unwrap()
                    .push((request.body.clone(), request.encoding));
                Box::pin(async { Ok(response(204)) })
            })),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Complete))
            .answers(&|_, _, _| Box::pin(async { Ok(response(201)) })),
    ));
    let progress = Arc::new(Mutex::new(Vec::<Progress>::new()));
    let observed_progress = Arc::clone(&progress);
    let reporter = Unimock::new(ReporterMock::progress.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, value| observed_progress.lock().unwrap().push(value.clone())),
    ));
    let result = client(http, Arc::new(reporter), super::support::clock())
        .publish(&prepared, &settings(1), &active())
        .await
        .unwrap();
    let captured = captured.lock().unwrap();
    assert_eq!(captured.len(), 1);
    assert_eq!(captured[0].1, Encoding::Gzip);
    assert!(captured[0].0.len() < 8192);
    let mut decoded = Vec::new();
    GzDecoder::new(captured[0].0.as_ref())
        .read_to_end(&mut decoded)
        .unwrap();
    assert_eq!(digest(&decoded), expected_digest);
    assert_eq!(result.completion.outcome, Outcome::Published);
    let expected_size = prepared
        .plan_files
        .iter()
        .map(|file| file.bytes.len() as u64)
        .sum::<u64>()
        + 8192;
    assert_eq!(progress.lock().unwrap()[0].size, expected_size);
}

#[tokio::test]
async fn unusable_plan_encoding_and_incompressible_bytes_stay_raw() {
    for (encodings, bytes) in [
        (Some(json!("gzip")), Bytes::from(vec![b'a'; 3])),
        (
            Some(json!(["br"])),
            Bytes::from((0..8192).map(|n| n as u8).collect::<Vec<_>>()),
        ),
        (None, Bytes::from_static(b"raw")),
    ] {
        let prepared = prepared_with_file("static/blob.bin", bytes.clone());
        let digest = prepared
            .ownership
            .files
            .iter()
            .find(|entry| entry.path == "static/blob.bin")
            .unwrap()
            .sha256
            .clone();
        let planned = plan_response(&digest, encodings);
        let captured = Arc::new(Mutex::new(None));
        let observed = Arc::clone(&captured);
        let http = Unimock::new((
            HttpMock::send
                .next_call(matching!((request, _) if request.step == Step::Plan))
                .answers_arc(Arc::new(move |_, _, _| {
                    let response = planned.clone();
                    Box::pin(async { Ok(response) })
                })),
            HttpMock::send
                .next_call(matching!((request, _) if request.step == Step::Blob))
                .answers_arc(Arc::new(move |_, request, _| {
                    *observed.lock().unwrap() = Some((request.body.clone(), request.encoding));
                    Box::pin(async { Ok(response(204)) })
                })),
            HttpMock::send
                .next_call(matching!((request, _) if request.step == Step::Complete))
                .answers(&|_, _, _| Box::pin(async { Ok(response(201)) })),
        ));
        client(http, super::support::reporter(), super::support::clock())
            .publish(&prepared, &settings(1), &active())
            .await
            .unwrap();
        assert_eq!(
            captured.lock().unwrap().take(),
            Some((bytes, Encoding::Identity))
        );
    }
}

#[tokio::test]
async fn retry_reuses_the_same_gzip_body_and_encoding() {
    let prepared = prepared_with_file("static/retry.bin", vec![b'b'; 8192].into());
    let digest = prepared
        .ownership
        .files
        .iter()
        .find(|entry| entry.path == "static/retry.bin")
        .unwrap()
        .sha256
        .clone();
    let planned = plan_response(&digest, Some(json!(["gzip"])));
    let captured = Arc::new(Mutex::new(Vec::new()));
    let observed = Arc::clone(&captured);
    let attempts = Arc::new(Mutex::new(0));
    let observed_attempts = Arc::clone(&attempts);
    let http = Unimock::new(
        HttpMock::send
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                if request.step == Step::Plan {
                    let response = planned.clone();
                    Box::pin(async move { Ok(response) })
                } else if request.step == Step::Blob {
                    observed
                        .lock()
                        .unwrap()
                        .push((request.body.clone(), request.encoding));
                    let mut attempts = observed_attempts.lock().unwrap();
                    *attempts += 1;
                    let status = if *attempts == 1 { 503 } else { 204 };
                    Box::pin(async move { Ok(response(status)) })
                } else {
                    Box::pin(async { Ok(response(201)) })
                }
            })),
    );
    client(
        http,
        super::support::reporter(),
        Arc::new(clock_with_retry()),
    )
    .publish(&prepared, &settings(1), &active())
    .await
    .unwrap();
    let captured = captured.lock().unwrap();
    assert_eq!(captured.len(), 2);
    assert_eq!(captured[0], captured[1]);
}

#[tokio::test]
async fn ready_cancellation_during_gzip_sends_no_blob_request() {
    let prepared = prepared_with_file("static/cancel.bin", vec![b'c'; 8192].into());
    let digest = prepared
        .ownership
        .files
        .iter()
        .find(|entry| entry.path == "static/cancel.bin")
        .unwrap()
        .sha256
        .clone();
    let planned = plan_response(&digest, Some(json!(["gzip"])));
    let http = Unimock::new(
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = planned.clone();
                Box::pin(async { Ok(response) })
            })),
    );
    let cancellation = Unimock::new((
        mokly_git::command::CancellationMock::is_cancelled
            .each_call(matching!())
            .returns(false),
        CancellationMock::cancelled
            .each_call(matching!())
            .answers(&|_| Box::pin(async {})),
    ));
    let result = client(http, super::support::reporter(), Arc::new(Unimock::new(())))
        .publish(&prepared, &settings(1), &cancellation)
        .await;
    assert!(matches!(result, Err(Error::Cancelled)));
}
