//! Real HTTP exchange with an independent local receiver and installed byte inventory.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::sync::{Arc, Mutex};

use mokly_model::output::validation::{MARKER, digest};
use mokly_publish::completion::Outcome;
use mokly_publish::exchange::{Client, Exchange};
use mokly_publish::http::ReqwestHttp;
use mokly_publish::runtime::{CommandCancellation, SilentReporter, SystemClock};
use mokly_publish::settings::Settings;
use mokly_publish::snapshot::Prepared;
use mokly_test_support::server::{Response, Server};
use serde_json::{Value, json};
use support::catalogue::{artifact, validate_plan};

mod support;

#[derive(Default)]
struct Receiver {
    stored: BTreeMap<String, Vec<u8>>,
    calls: Vec<String>,
    published: bool,
}

#[tokio::test]
async fn finalized_output_is_uploaded_and_a_second_publication_keeps_the_first() {
    for comparison in [false, true] {
        let directory = tempfile::tempdir().unwrap();
        let output = artifact(directory.path().join("publish"), comparison);
        for file in &output.files {
            let path = output.directory.join(&file.path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, &file.bytes).unwrap();
        }
        let state = Arc::new(Mutex::new(Receiver::default()));
        let observed = Arc::clone(&state);
        let expected = output.clone();
        let fixture: Value = serde_json::from_str(include_str!(
            "../../../docs/protocol/fixtures/upload-plan-v1.json"
        ))
        .unwrap();
        let plan_fixture = fixture["cases"]
            .as_array()
            .unwrap()
            .iter()
            .find(|case| case["name"] == "two-missing-digests")
            .unwrap()["document"]
            .clone();
        let complete_fixture = fixture["cases"]
            .as_array()
            .unwrap()
            .iter()
            .find(|case| case["name"] == "complete-201-new-publication")
            .unwrap()["document"]
            .clone();
        let server = Server::start(Arc::new(move |request| {
            assert_eq!(request.headers["authorization"], "Bearer secret/a==");
            assert_eq!(
                request.headers["content-length"],
                request.body.len().to_string()
            );
            let mut state = observed.lock().unwrap();
            state
                .calls
                .push(format!("{} {}", request.method, request.target));
            let origin = format!("http://{}", request.headers["host"]);
            if request.target == "/custom/plan?query=kept=2" {
                assert_eq!(request.method, "POST");
                assert_eq!(request.headers["content-type"], "application/gzip");
                assert_eq!(request.headers["accept"], "application/json");
                let files = validate_plan(&request.body, &expected);
                for bytes in files.values() {
                    state.stored.insert(digest(bytes), bytes.clone());
                }
                let digests: BTreeSet<_> = expected
                    .files
                    .iter()
                    .filter(|file| file.path != MARKER)
                    .map(|file| digest(&file.bytes))
                    .collect();
                let missing: Vec<_> = if state.published {
                    Vec::new()
                } else {
                    digests
                        .into_iter()
                        .filter(|digest| !state.stored.contains_key(digest))
                        .collect()
                };
                let mut planned = plan_fixture.clone();
                planned["missing"] = json!(missing);
                planned["upload"]["expiresAt"] = json!("2099-01-01T00:00:00.000Z");
                planned["blobUrl"] = json!(format!("{origin}/opaque/blobs/{{sha256}}?signed=1"));
                planned["completeUrl"] = json!(format!("{origin}/opaque/complete?commit=1"));
                Response::json(200, serde_json::to_vec(&planned).unwrap())
            } else if let Some(path) = request.target.strip_prefix("/opaque/blobs/") {
                assert_eq!(request.method, "PUT");
                assert_eq!(request.headers["content-type"], "application/octet-stream");
                let declared = path.strip_suffix("?signed=1").unwrap();
                assert_eq!(digest(&request.body), declared);
                assert!(
                    expected
                        .files
                        .iter()
                        .any(|file| digest(&file.bytes) == declared && file.bytes == request.body)
                );
                state.stored.insert(declared.to_owned(), request.body);
                Response::json(204, Vec::new())
            } else {
                assert_eq!(request.target, "/opaque/complete?commit=1");
                assert_eq!(request.method, "POST");
                assert!(request.body.is_empty());
                assert_eq!(request.headers["accept"], "application/json");
                assert!(
                    expected
                        .files
                        .iter()
                        .filter(|file| file.path != MARKER)
                        .all(|file| state.stored.contains_key(&digest(&file.bytes)))
                );
                let status = if state.published { 200 } else { 201 };
                state.published = true;
                Response::json(status, serde_json::to_vec(&complete_fixture).unwrap())
            }
        }));
        let settings = Settings::new(
            &format!("{}/custom/plan?query=kept=2", server.origin),
            "secret/a==".to_owned(),
            2,
        )
        .unwrap();
        let client: &dyn Exchange = &Client {
            http: Arc::new(ReqwestHttp::new().unwrap()),
            clock: Arc::new(SystemClock),
            reporter: Arc::new(SilentReporter),
        };
        let prepared = Prepared::new(&output).unwrap();
        let result = client
            .publish(&prepared, &settings, &CommandCancellation::default())
            .await
            .unwrap();
        assert_eq!(result.completion.outcome, Outcome::Published);
        assert_eq!(result.uploaded, output.files.len() - 1);
        assert_eq!(result.unchanged, 0);
        let calls = state.lock().unwrap().calls.len();
        assert_eq!(calls, 4);
        let result = client
            .publish(&prepared, &settings, &CommandCancellation::default())
            .await
            .unwrap();
        assert_eq!(result.completion.outcome, Outcome::AlreadyPublished);
        assert_eq!(state.lock().unwrap().calls.len(), calls + 2);
        for file in &output.files {
            assert_eq!(
                fs::read(output.directory.join(&file.path)).unwrap(),
                file.bytes
            );
        }
        server.finish().await;
    }
}

#[tokio::test]
async fn failed_upload_keeps_the_complete_installed_byte_snapshot() {
    let directory = tempfile::tempdir().unwrap();
    let output = artifact(directory.path().join("publish"), true);
    for file in &output.files {
        let path = output.directory.join(&file.path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, &file.bytes).unwrap();
    }
    let server = Server::start(Arc::new(|request| {
        assert_eq!(request.method, "POST");
        assert_eq!(request.target, "/plan");
        Response::json(401, b"secret receiver rejection".to_vec())
    }));
    let settings = Settings::new(
        &format!("{}/plan", server.origin),
        "secret/a==".to_owned(),
        8,
    )
    .unwrap();
    let client: &dyn Exchange = &Client {
        http: Arc::new(ReqwestHttp::new().unwrap()),
        clock: Arc::new(SystemClock),
        reporter: Arc::new(SilentReporter),
    };
    let result = client
        .publish(
            &Prepared::new(&output).unwrap(),
            &settings,
            &CommandCancellation::default(),
        )
        .await;
    assert!(matches!(
        result,
        Err(mokly_publish::error::Error::Unauthorized)
    ));
    assert!(output.directory.is_dir());
    for file in &output.files {
        assert_eq!(
            fs::read(output.directory.join(&file.path)).unwrap(),
            file.bytes
        );
    }
    server.finish().await;
}
