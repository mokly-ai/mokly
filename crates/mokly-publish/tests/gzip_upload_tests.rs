//! Reqwest integration tests for encoded and raw Blob requests.

use std::collections::BTreeMap;
use std::io::Read;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use bytes::Bytes;
use flate2::read::GzDecoder;
use futures_util::future::BoxFuture;
use mokly_model::output::artifact::Artifact;
use mokly_model::output::upload::UploadMetadata;
use mokly_model::output::validation::{MANIFEST, MARKER};
use mokly_publish::completion::Outcome;
use mokly_publish::exchange::{Client, Exchange};
use mokly_publish::http::ReqwestHttp;
use mokly_publish::redaction::Secret;
use mokly_publish::runtime::{Clock, CommandCancellation, SilentReporter, Timer};
use mokly_publish::settings::Settings;
use mokly_publish::snapshot::Prepared;
use serde_json::json;
use support::catalogue::artifact;
use support::server::{Request, Response, Server};

mod support;

struct FixedClock;

impl Clock for FixedClock {
    fn now(&self) -> i64 {
        1_800_000_000_000
    }

    fn jitter(&self, _: u64) -> u64 {
        0
    }

    fn sleep(&self, _: Timer, _: Duration) -> BoxFuture<'_, ()> {
        Box::pin(async {})
    }
}

fn file(path: &str, bytes: &[u8]) -> mokly_model::output::artifact::File {
    mokly_model::output::artifact::File {
        path: path.to_owned(),
        bytes: Bytes::copy_from_slice(bytes),
    }
}

fn prepared() -> (Prepared, BTreeMap<String, Bytes>, Artifact) {
    let base = artifact(PathBuf::from("/unused/frozen"), true);
    let metadata = UploadMetadata::parse(
        &base
            .files
            .iter()
            .find(|file| file.path == MANIFEST)
            .unwrap()
            .bytes,
    )
    .unwrap();
    let compressible: Bytes = vec![b'a'; 8192].into();
    let mut state = 0x1234_5678_u32;
    let mut random = Vec::with_capacity(8192);
    while random.len() < 8192 {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        random.extend_from_slice(&state.to_le_bytes());
    }
    random.truncate(8192);
    let incompressible: Bytes = random.into();
    let tiny = Bytes::from_static(b"x");
    let files = base
        .files
        .into_iter()
        .filter(|file| file.path != MANIFEST && file.path != MARKER)
        .chain([
            file("static/compressible.bin", &compressible),
            file("static/incompressible.bin", &incompressible),
            file("static/tiny.bin", &tiny),
        ])
        .collect();
    let artifact = Artifact::finalize(base.directory, files, Some(metadata)).unwrap();
    let prepared = Prepared::new(&artifact).unwrap();
    let expected = [
        "static/compressible.bin",
        "static/incompressible.bin",
        "static/tiny.bin",
    ]
    .into_iter()
    .map(|path| {
        let digest = prepared
            .ownership
            .files
            .iter()
            .find(|entry| entry.path == path)
            .unwrap()
            .sha256
            .clone();
        (digest.clone(), prepared.blobs[&digest].clone())
    })
    .collect();
    (prepared, expected, artifact)
}

async fn run_receiver(list_gzip: bool) -> (Vec<Request>, BTreeMap<String, Bytes>, Outcome) {
    let (prepared, expected, artifact) = prepared();
    let missing = expected.keys().cloned().collect::<Vec<_>>();
    let captured = Arc::new(Mutex::new(Vec::new()));
    let state = Arc::clone(&captured);
    let expected_artifact = artifact.clone();
    let server = Server::start(Arc::new(move |request| {
        if request.method == "PUT" {
            state.lock().unwrap().push(request);
            return Response::json(204, Vec::new());
        }
        if request.target.ends_with("/complete") {
            return Response::json(201, b"{}".to_vec());
        }
        support::catalogue::validate_plan(&request.body, &expected_artifact);
        let origin = format!("http://{}", request.headers["host"]);
        let mut document = json!({
            "schemaVersion": 1,
            "upload": {"id": "upload-1", "expiresAt": "2030-09-26T13:00:00.000Z"},
            "missing": missing,
            "blobUrl": format!("{origin}/blobs/{{sha256}}"),
            "completeUrl": format!("{origin}/complete")
        });
        if list_gzip {
            document["blobEncodings"] = json!(["gzip"]);
        }
        Response::json(200, serde_json::to_vec(&document).unwrap())
    }));
    let settings =
        Settings::new(&format!("{}/plan", server.origin), Secret::new("secret"), 2).unwrap();
    let client = Client {
        http: Arc::new(ReqwestHttp::new().unwrap()),
        clock: Arc::new(FixedClock),
        reporter: Arc::new(SilentReporter),
    };
    let receipt = client
        .publish(&prepared, &settings, &CommandCancellation::default())
        .await
        .unwrap();
    server.finish().await;
    let requests = Arc::try_unwrap(captured).unwrap().into_inner().unwrap();
    (requests, expected, receipt.completion.outcome)
}

fn check_requests(requests: &[Request], expected: &BTreeMap<String, Bytes>, gzip: bool) {
    for (digest, file) in expected {
        let request = requests
            .iter()
            .find(|request| request.target.ends_with(digest))
            .unwrap();
        assert_eq!(
            request.headers["content-length"],
            request.body.len().to_string()
        );
        if gzip && file.len() == 8192 && file.iter().all(|byte| *byte == b'a') {
            assert_eq!(
                request.headers.get("content-encoding"),
                Some(&"gzip".to_owned())
            );
            assert!(request.body.len() < file.len());
            let mut decoded = Vec::new();
            GzDecoder::new(request.body.as_slice())
                .take(file.len() as u64 + 1)
                .read_to_end(&mut decoded)
                .unwrap();
            assert_eq!(decoded, file.as_ref());
        } else {
            assert!(!request.headers.contains_key("content-encoding"));
            assert_eq!(request.body, file.as_ref());
        }
    }
}

#[tokio::test]
async fn a_receiver_listing_gzip_gets_encoded_compressible_blobs_and_raw_others() {
    let (requests, expected, outcome) = run_receiver(true).await;
    check_requests(&requests, &expected, true);
    assert_eq!(outcome, Outcome::Published);
}

#[tokio::test]
async fn a_receiver_without_gzip_listing_gets_only_raw_blobs() {
    let (requests, expected, outcome) = run_receiver(false).await;
    check_requests(&requests, &expected, false);
    assert_eq!(outcome, Outcome::Published);
}
