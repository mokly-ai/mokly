//! Shared doubles for the plan, blob and completion handlers.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod blob_tests;
mod build;
mod completion_tests;
mod gzip_blob_tests;
mod plan_tests;

use std::collections::HashMap;
use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::extract::Request;
use axum::http::StatusCode;
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_publications::ingest::{IngestMock, UploadAuthorization};
use mkc_publications::locations::Locations;
use mkc_upload_memory_interface::budget::UploadMemoryReservation;
use serde_json::Value;
use tokio::sync::Semaphore;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::operation::Operation;
use crate::upload::{StreamingUpload, UploadHandler};

pub(super) const PROJECT: ProjectId = ProjectId(Uuid::from_u128(1));
pub(super) const UPLOAD: PublicationId = PublicationId(Uuid::from_u128(2));
pub(super) const BEARER: &str =
    "mkc_0000000000000000000000000000000000000000000000000000000000000000";
pub(super) const ORIGIN: &str = "https://api.example.com";

/// One failure case: the service outcome, the rendered status and its label.
pub(super) type Case<T> = (fn() -> T, StatusCode, &'static str);

/// A reservation that holds nothing; dropping it is the release.
pub(super) struct Held;

impl UploadMemoryReservation for Held {}

/// The bearer resolves to an authorization for the route's project.
pub(super) fn authorized() -> impl Clause {
    IngestMock::authorize
        .next_call(matching!(_, _))
        .answers(&|_, project, bearer| {
            assert_eq!(bearer, BEARER);
            Ok(UploadAuthorization::for_tests(
                project,
                "acme".parse().unwrap(),
                "web".parse().unwrap(),
            ))
        })
}

/// Handlers over mocked ingest and memory doubles.
pub(super) fn upload(ingest: Unimock, memory: Unimock) -> StreamingUpload {
    StreamingUpload {
        ingest: Arc::new(ingest),
        locations: Locations {
            app_origin: "https://app.example.com".into(),
            catalogue_domain: "example.net".into(),
            catalogue_scheme: "https".into(),
            catalogue_port: None,
        },
        api_origin: ORIGIN.into(),
        admission: Arc::new(Semaphore::new(2)),
        memory: Arc::new(memory),
        blob_gzip: false,
    }
}

/// Route parameters as the router extracts them.
pub(super) fn params(entries: &[(&str, String)]) -> HashMap<String, String> {
    entries
        .iter()
        .map(|(key, value)| ((*key).to_owned(), value.clone()))
        .collect()
}

/// A request carrying the shared bearer plus the given headers and body.
pub(super) fn request(uri: &str, headers: &[(&str, &str)], body: Body) -> Request {
    let mut builder = Request::builder()
        .method("POST")
        .uri(uri)
        .header("authorization", format!("Bearer {BEARER}"));
    for (name, value) in headers {
        builder = builder.header(*name, *value);
    }
    builder.body(body).unwrap()
}

/// Run one operation and return its status with the JSON body, `Null` when empty.
pub(super) async fn send(
    upload: &StreamingUpload,
    operation: Operation,
    params: HashMap<String, String>,
    request: Request,
) -> (StatusCode, Value) {
    let response = upload.handle(operation, params, request).await;
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap()
    };
    (status, body)
}

/// The rendered error label.
pub(super) fn reason(body: &Value) -> &str {
    body["error"]["reason"].as_str().unwrap()
}
