//! Build bearer bodies, typed response mapping, ranked outcomes and safe diagnostics.

use std::collections::HashMap;
use std::convert::Infallible;
use std::io::{self, Write};
use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};

use axum::body::{Body, Bytes};
use axum::http::Request;
use http_body::Frame;
use mkc_publications::error::Error;
use mkc_publications::ingest::IngestMock;
use mkc_store_interface::build_state::UploadOutcome;
use tracing_subscriber::fmt::MakeWriter;
use unimock::{Clause, MockFn, Unimock, matching};

use crate::operation::Operation;

use super::super::{PROJECT, UPLOAD, params};

pub(super) const BEARER: &str =
    "mkb_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

pub(super) struct UnreadBody(pub(super) Arc<AtomicUsize>);

impl http_body::Body for UnreadBody {
    type Data = Bytes;
    type Error = Infallible;
    fn poll_frame(
        self: Pin<&mut Self>,
        _: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Bytes>, Infallible>>> {
        self.0.fetch_add(1, Ordering::SeqCst);
        Poll::Ready(Some(Ok(Frame::data(Bytes::from_static(b"body")))))
    }
}

#[derive(Clone)]
pub(super) struct Logs(pub(super) Arc<Mutex<Vec<u8>>>);

impl Write for Logs {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.lock().unwrap().extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl<'a> MakeWriter<'a> for Logs {
    type Writer = Self;
    fn make_writer(&'a self) -> Self {
        self.clone()
    }
}

pub(super) fn recorded(outcome: UploadOutcome) -> impl Clause {
    IngestMock::record_upload_outcome
        .next_call(matching!(_, _, _))
        .answers_arc(Arc::new(move |_, project, bearer, observed| {
            assert_eq!(project, PROJECT);
            assert_eq!(bearer, BEARER);
            assert_eq!(observed, outcome);
            Ok(())
        }))
}

pub(super) fn denied(
    operation: Operation,
    error: fn() -> Error,
    outcome: Option<UploadOutcome>,
) -> Unimock {
    match (operation == Operation::CompletePublicationUpload, outcome) {
        (true, Some(outcome)) => Unimock::new((
            IngestMock::authorize_completion
                .next_call(matching!(&PROJECT, &BEARER, &UPLOAD))
                .answers_arc(Arc::new(move |_, _, _, _| Err(error()))),
            recorded(outcome),
        )),
        (false, Some(outcome)) => Unimock::new((
            IngestMock::authorize
                .next_call(matching!(&PROJECT, &BEARER))
                .answers_arc(Arc::new(move |_, _, _| Err(error()))),
            recorded(outcome),
        )),
        (true, None) => Unimock::new(
            IngestMock::authorize_completion
                .next_call(matching!(&PROJECT, &BEARER, &UPLOAD))
                .answers_arc(Arc::new(move |_, _, _, _| Err(error()))),
        ),
        (false, None) => Unimock::new(
            IngestMock::authorize
                .next_call(matching!(&PROJECT, &BEARER))
                .answers_arc(Arc::new(move |_, _, _| Err(error()))),
        ),
    }
}

pub(super) fn authorization() -> mkc_publications::ingest::UploadAuthorization {
    mkc_publications::ingest::UploadAuthorization::for_tests(
        PROJECT,
        "acme".parse().unwrap(),
        "web".parse().unwrap(),
    )
}

pub(super) fn request(body: Body) -> axum::extract::Request {
    Request::builder()
        .uri("/upload")
        .header("authorization", format!("Bearer {BEARER}"))
        .header("content-type", "application/gzip")
        .body(body)
        .unwrap()
}

pub(super) fn route_params() -> HashMap<String, String> {
    params(&[
        ("projectId", PROJECT.0.to_string()),
        ("publicationId", UPLOAD.0.to_string()),
        ("sha256", "a".repeat(64)),
    ])
}
