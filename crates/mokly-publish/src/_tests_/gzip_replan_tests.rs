//! Re-plan tests for changing and repeating the Blob encoding offer.

use std::sync::{Arc, Mutex};

use bytes::Bytes;
use mokly_model::output::artifact::Artifact;
use mokly_model::output::validation::{MANIFEST, MARKER};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::exchange::{Client, Exchange};
use crate::http::{Body, Encoding, HttpMock, Step};
use crate::snapshot::Prepared;

use super::support::{active, artifact, file, inventory, publication, response, settings};

fn prepared() -> (Prepared, Bytes) {
    let base = artifact(false);
    let bytes: Bytes = vec![b'z'; 8192].into();
    let files = base
        .files
        .into_iter()
        .filter(|file| file.path != MANIFEST && file.path != MARKER)
        .chain(std::iter::once(file("static/replan.bin", &bytes)))
        .collect();
    let artifact = Artifact::finalize(
        base.directory,
        files,
        Some(publication().metadata(&inventory(false)).unwrap()),
    )
    .unwrap();
    (Prepared::new(&artifact).unwrap(), bytes)
}

fn plan(digest: &str, encodings: Option<serde_json::Value>) -> crate::http::Response {
    let mut document = json!({
        "schemaVersion": 1,
        "upload": {"id": "upload-1", "expiresAt": "2030-09-26T13:00:00.000Z"},
        "missing": [digest],
        "blobUrl": "https://api.example.com/blobs/{sha256}",
        "completeUrl": "https://api.example.com/complete"
    });
    if let Some(encodings) = encodings {
        document["blobEncodings"] = encodings;
    }
    crate::http::Response {
        body: Body::Bytes(serde_json::to_vec(&document).unwrap().into()),
        ..response(200)
    }
}

async fn run(second_encoding: Option<serde_json::Value>) -> (Vec<(Bytes, Encoding)>, Bytes) {
    let (prepared, file) = prepared();
    let digest = prepared
        .ownership
        .files
        .iter()
        .find(|entry| entry.path == "static/replan.bin")
        .unwrap()
        .sha256
        .clone();
    let plans = Arc::new(Mutex::new(vec![
        plan(&digest, Some(json!(["gzip"]))),
        plan(&digest, second_encoding),
    ]));
    let completions = Arc::new(Mutex::new(0));
    let bodies = Arc::new(Mutex::new(Vec::new()));
    let captured_bodies = Arc::clone(&bodies);
    let http = Unimock::new(
        HttpMock::send
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                if request.step == Step::Plan {
                    let response = plans.lock().unwrap().remove(0);
                    Box::pin(async move { Ok(response) })
                } else if request.step == Step::Blob {
                    captured_bodies
                        .lock()
                        .unwrap()
                        .push((request.body.clone(), request.encoding));
                    Box::pin(async { Ok(response(204)) })
                } else {
                    let mut completions = completions.lock().unwrap();
                    *completions += 1;
                    let status = if *completions == 1 { 409 } else { 201 };
                    Box::pin(async move { Ok(response(status)) })
                }
            })),
    );
    Client {
        http: Arc::new(http),
        clock: super::support::clock(),
        reporter: super::support::reporter(),
    }
    .publish(&prepared, &settings(1), &active())
    .await
    .unwrap();
    (Arc::try_unwrap(bodies).unwrap().into_inner().unwrap(), file)
}

#[tokio::test]
async fn a_replan_without_gzip_sends_raw_bytes_after_a_gzip_round() {
    let (bodies, file) = run(None).await;
    assert_eq!(bodies.len(), 2);
    assert_eq!(bodies[0].1, Encoding::Gzip);
    assert_eq!(bodies[1], (file, Encoding::Identity));
}

#[tokio::test]
async fn two_gzip_rounds_send_equal_bodies() {
    let (bodies, _) = run(Some(json!(["gzip"]))).await;
    assert_eq!(bodies.len(), 2);
    assert_eq!(bodies[0].1, Encoding::Gzip);
    assert_eq!(bodies[0], bodies[1]);
}
