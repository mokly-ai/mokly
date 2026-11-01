//! Public upload fixtures cross the actual HTTP boundary without following redirects.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use bytes::Bytes;
use mokly_publish::completion::{Completion, Outcome, retryable};
use mokly_publish::error::Error;
use mokly_publish::http::{Encoding, Http, Request, ReqwestHttp, Step};
use mokly_publish::plan::Plan;
use mokly_publish::redaction::Secret;
use mokly_publish::settings::Settings;
use mokly_publish::snapshot::Prepared;
use serde_json::Value;
use support::catalogue::{artifact, validate_plan};
use support::server::{Response, Server};

mod support;

#[tokio::test]
async fn all_plan_and_complete_cases_run_against_the_local_fixture_receiver() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../../docs/protocol/fixtures/upload-plan-v1.json"
    ))
    .unwrap();
    let fixture_cases = fixture["cases"].as_array().unwrap().clone();
    let cases = fixture_cases.clone();
    let index = Arc::new(AtomicUsize::new(0));
    let calls = Arc::clone(&index);
    let output = artifact("/unused/frozen".into(), true);
    let expected = output.clone();
    let server = Server::start(Arc::new(move |request| {
        let case = &cases[calls.fetch_add(1, Ordering::SeqCst)];
        assert_eq!(request.headers["authorization"], "Bearer secret");
        assert_eq!(request.method, "POST");
        assert_eq!(request.target, "/exact/plan?preserved=1=2");
        if case["step"] == "complete" {
            assert!(request.body.is_empty());
        } else {
            assert_eq!(request.headers["content-type"], "application/gzip");
            validate_plan(&request.body, &expected);
        }
        let raw = case["body"].as_str().map_or_else(
            || serde_json::to_string(&case["document"]).unwrap(),
            str::to_owned,
        );
        let origin = format!("http://{}", request.headers["host"]);
        let body = raw
            .replace("https://api.example.com:443", &origin)
            .replace("https://api.example.com", &origin)
            .into_bytes();
        Response {
            declared_length: None,
            status: case["status"].as_u64().unwrap_or(200) as u16,
            content_type: match case.get("contentType") {
                None => Some("application/json".to_owned()),
                Some(value) => value.as_str().map(str::to_owned),
            },
            body,
            headers: Vec::new(),
        }
    }));
    let settings = Settings::new(
        &format!("{}/exact/plan?preserved=1=2", server.origin),
        Secret::new("secret"),
        8,
    )
    .unwrap();
    let http: &dyn Http = &ReqwestHttp::new().unwrap();
    let digests = fixture["marker"]
        .as_array()
        .unwrap()
        .iter()
        .map(|value| value.as_str().unwrap().to_owned())
        .collect();
    let prepared = Prepared::new(&output).unwrap();
    for case in fixture_cases {
        let step = if case["step"] == "complete" {
            Step::Complete
        } else {
            Step::Plan
        };
        let request = Request {
            step,
            url: settings.endpoint().clone(),
            body: if step == Step::Complete {
                Bytes::new()
            } else {
                prepared.archive.clone()
            },
            encoding: Encoding::Identity,
            timeout: Duration::from_secs(120),
        };
        let response = http.send(&request, settings.token()).await.unwrap();
        if step == Step::Plan {
            let parsed = Plan::parse(&response, &settings, &digests);
            assert_eq!(parsed.is_ok(), case["valid"] == true, "{}", case["name"]);
            if let Ok(plan) = parsed {
                let encoding = if case["blobEncoding"] == "gzip" {
                    Encoding::Gzip
                } else {
                    Encoding::Identity
                };
                assert_eq!(plan.blob_encoding, encoding, "{}", case["name"]);
            }
        } else if case["outcome"] == "retry" {
            assert_eq!(
                completion_outcome(&response, &settings),
                case["outcome"].as_str().unwrap(),
                "{}",
                case["name"]
            );
        } else {
            assert_eq!(
                completion_outcome(&response, &settings),
                case["outcome"].as_str().unwrap(),
                "{}",
                case["name"]
            );
            let completed = Completion::parse(&response, settings.token());
            assert_eq!(completed.is_ok(), case["valid"] == true, "{}", case["name"]);
            if let Ok(completed) = completed {
                assert_eq!(completed.viewer_url.as_deref(), case["viewerUrl"].as_str());
            }
        }
    }
    assert_eq!(index.load(Ordering::SeqCst), 74);
    server.finish().await;
}

#[tokio::test]
async fn redirects_are_returned_without_forwarding_the_bearer_credential() {
    let forwarded = Arc::new(AtomicUsize::new(0));
    let captured = Arc::clone(&forwarded);
    let target = Server::start(Arc::new(move |_| {
        captured.fetch_add(1, Ordering::SeqCst);
        Response::json(200, b"{}".to_vec())
    }));
    let location = format!("{}/stolen", target.origin);
    let source = Server::start(Arc::new(move |request| {
        assert_eq!(request.headers["authorization"], "Bearer secret");
        Response {
            status: 302,
            declared_length: None,
            content_type: None,
            body: Vec::new(),
            headers: vec![("Location".to_owned(), location.clone())],
        }
    }));
    let settings =
        Settings::new(&format!("{}/plan", source.origin), Secret::new("secret"), 1).unwrap();
    let http: &dyn Http = &ReqwestHttp::new().unwrap();
    let response = http
        .send(
            &Request {
                step: Step::Plan,
                url: settings.endpoint().clone(),
                body: Bytes::new(),
                encoding: Encoding::Identity,
                timeout: Duration::from_secs(120),
            },
            settings.token(),
        )
        .await
        .unwrap();
    assert_eq!(response.status, 302);
    assert_eq!(forwarded.load(Ordering::SeqCst), 0);
    source.finish().await;
    target.finish().await;
}

#[tokio::test]
async fn declared_and_streamed_excess_are_bounded_and_unreadable_completion_still_succeeds() {
    for declared in [false, true] {
        let server = Server::start(Arc::new(move |_| Response {
            status: 200,
            declared_length: declared.then_some(16 * 1024 * 1024 + 1),
            content_type: Some("application/json".to_owned()),
            body: if declared {
                Vec::new()
            } else {
                vec![b' '; 16 * 1024 * 1024 + 1]
            },
            headers: Vec::new(),
        }));
        let settings =
            Settings::new(&format!("{}/plan", server.origin), Secret::new("secret"), 1).unwrap();
        let http: &dyn Http = &ReqwestHttp::new().unwrap();
        let response = http
            .send(
                &Request {
                    step: Step::Plan,
                    url: settings.endpoint().clone(),
                    body: Bytes::new(),
                    encoding: Encoding::Identity,
                    timeout: Duration::from_secs(120),
                },
                settings.token(),
            )
            .await
            .unwrap();
        assert!(matches!(
            response.body,
            mokly_publish::http::Body::Oversized
        ));
        server.finish().await;
    }
    let server = Server::start(Arc::new(|_| Response {
        status: 201,
        declared_length: Some(100),
        content_type: Some("application/json".to_owned()),
        body: b"{\"viewerUrl\":".to_vec(),
        headers: Vec::new(),
    }));
    let settings = Settings::new(
        &format!("{}/complete", server.origin),
        Secret::new("secret"),
        1,
    )
    .unwrap();
    let http: &dyn Http = &ReqwestHttp::new().unwrap();
    let response = http
        .send(
            &Request {
                step: Step::Complete,
                url: settings.endpoint().clone(),
                body: Bytes::new(),
                encoding: Encoding::Identity,
                timeout: Duration::from_secs(120),
            },
            settings.token(),
        )
        .await
        .unwrap();
    assert!(matches!(
        response.body,
        mokly_publish::http::Body::Unreadable
    ));
    assert!(
        Completion::parse(&response, settings.token())
            .unwrap()
            .viewer_url
            .is_none()
    );
    server.finish().await;
}

fn completion_outcome(
    response: &mokly_publish::http::Response,
    settings: &Settings,
) -> &'static str {
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
