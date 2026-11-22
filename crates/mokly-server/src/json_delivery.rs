//! JSON content negotiation and lazy, single-flight gzip encoding.

use std::collections::BTreeMap;
use std::convert::Infallible;
use std::io::Write;
use std::sync::{Arc, Mutex, OnceLock};

use axum::body::{Body, Bytes};
use axum::http::header::{ACCEPT_ENCODING, CONTENT_ENCODING, CONTENT_LENGTH, VARY};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use flate2::Compression;
use flate2::write::GzEncoder;
use tokio::sync::watch;

use crate::error::{InternalError, Result};
use crate::response;

pub(crate) const CONTENT_TYPE: &str = "application/json; charset=utf-8";

/// Use this on identity, gzip, and 304 JSON responses.
pub(crate) fn vary(response: &mut Response) {
    response
        .headers_mut()
        .insert(VARY, HeaderValue::from_static("Accept-Encoding"));
}

/// Mark a response body as gzip without changing its representation metadata.
pub(crate) fn mark_gzip(response: &mut Response) {
    response
        .headers_mut()
        .insert(CONTENT_ENCODING, HeaderValue::from_static("gzip"));
}

/// Determine whether a JSON representation can use gzip, across all field lines.
pub(crate) fn accepts_gzip(headers: &HeaderMap) -> bool {
    let mut gzip = None;
    let mut wildcard = false;
    for value in headers.get_all(ACCEPT_ENCODING) {
        let Ok(value) = value.to_str() else { continue };
        for item in value.split(',') {
            let (coding, parameters) = item.split_once(';').unwrap_or((item, ""));
            let coding = coding.trim();
            let accepted = accepts_quality(parameters.trim());
            if coding.eq_ignore_ascii_case("gzip") {
                gzip = Some(gzip.unwrap_or(true) && accepted);
            } else if coding == "*" {
                wildcard |= accepted;
            }
        }
    }
    gzip.unwrap_or(wildcard)
}

fn accepts_quality(parameters: &str) -> bool {
    if parameters.is_empty() {
        return true;
    }
    let Some((name, value)) = parameters.split_once('=') else {
        return false;
    };
    if !name.trim().eq_ignore_ascii_case("q") {
        return false;
    }
    let value = value.trim();
    let (whole, fraction) = value.split_once('.').unwrap_or((value, ""));
    if fraction.len() > 3 || !fraction.bytes().all(|byte| byte.is_ascii_digit()) {
        return false;
    }
    match whole {
        "0" => fraction.bytes().any(|byte| byte != b'0'),
        "1" => fraction.bytes().all(|byte| byte == b'0'),
        _ => false,
    }
}

/// One canonical identity body, with the current revision inserted as its own slice.
#[derive(Clone)]
pub(crate) enum JsonBody {
    Whole(Bytes),
    Revision([Bytes; 3]),
}

impl JsonBody {
    /// Negotiate a temporary bundle response without retaining another copy in its store.
    pub(crate) async fn temporary_response(self, headers: &HeaderMap) -> Response {
        let compressed = if accepts_gzip(headers) {
            let input = self.clone();
            Gzip::default().get(move || input.compress()).await
        } else {
            None
        };
        self.response(compressed)
    }

    /// Respond with the original bytes, or a compressed representation of them.
    pub(crate) fn response(self, compressed: Option<Bytes>) -> Response {
        if let Some(bytes) = compressed {
            let mut response = response::bytes(StatusCode::OK, CONTENT_TYPE, bytes);
            mark_gzip(&mut response);
            return response;
        }
        match self {
            Self::Whole(bytes) => response::bytes(StatusCode::OK, CONTENT_TYPE, bytes),
            Self::Revision(chunks) => {
                let length = chunks.iter().map(Bytes::len).sum::<usize>();
                let mut response = response::bytes(StatusCode::OK, CONTENT_TYPE, Bytes::new());
                response
                    .headers_mut()
                    .insert(CONTENT_LENGTH, HeaderValue::from(length));
                *response.body_mut() = Body::from_stream(async_stream::stream! {
                    for chunk in chunks {
                        yield Ok::<_, Infallible>(chunk);
                    }
                });
                response
            }
        }
    }

    /// Encode the original chunks without joining them into an intermediate body.
    pub(crate) fn compress(self) -> Result<Bytes> {
        let chunks = match &self {
            Self::Whole(bytes) => std::slice::from_ref(bytes),
            Self::Revision(chunks) => chunks,
        };
        let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
        for chunk in chunks {
            if let Err(source) = encoder.write_all(chunk) {
                return Err(InternalError::Io { source }.into());
            }
        }
        match encoder.finish() {
            Ok(bytes) => Ok(bytes.into()),
            Err(source) => Err(InternalError::Io { source }.into()),
        }
    }
}

#[derive(Clone)]
enum Encoding<T> {
    Pending,
    Ready(Option<T>),
}

/// A publication owns the slots for its gzip representations.
#[derive(Default)]
pub(crate) struct GzipFiles(Mutex<BTreeMap<String, Arc<Gzip<Bytes>>>>);

impl GzipFiles {
    /// Negotiate one publication file without creating a slot for identity requests.
    pub(crate) async fn response(
        &self,
        path: &str,
        headers: &HeaderMap,
        body: JsonBody,
    ) -> Response {
        let encoded = if accepts_gzip(headers) {
            self.get(path, body.clone()).await
        } else {
            None
        };
        body.response(encoded)
    }

    /// Encode one file in a detached blocking job that survives a cancelled request.
    pub(crate) async fn get(&self, path: &str, body: JsonBody) -> Option<Bytes> {
        self.slot(path).get(move || body.compress()).await
    }

    /// Reserve a slot while the file is still retained by its owner.
    pub(crate) fn slot(&self, path: &str) -> Arc<Gzip<Bytes>> {
        let mut files = self.0.lock().unwrap_or_else(|error| error.into_inner());
        files.entry(path.to_owned()).or_default().clone()
    }

    /// Drop cached representations of comparison snapshots when their files expire.
    pub(crate) fn remove_snapshots(&self) {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .retain(|path, _| !path.starts_with("snapshots/"));
    }
}

/// A detached blocking job that publishes one encoded version to every waiter.
pub(crate) struct Gzip<T>(OnceLock<watch::Receiver<Encoding<T>>>);

impl<T> Default for Gzip<T> {
    fn default() -> Self {
        Self(OnceLock::new())
    }
}

impl<T: Clone + Send + Sync + 'static> Gzip<T> {
    /// Start compression once, or share the result from the first caller.
    pub(crate) async fn get(
        &self,
        compress: impl FnOnce() -> Result<T> + Send + 'static,
    ) -> Option<T> {
        let mut result = self
            .0
            .get_or_init(|| {
                let (send, receive) = watch::channel(Encoding::Pending);
                let parent = tracing::Span::current();
                tokio::task::spawn_blocking(move || {
                    let bytes = match parent.in_scope(compress) {
                        Ok(bytes) => Some(bytes),
                        Err(error) => {
                            tracing::warn!(%error, "could not encode Serve JSON as gzip");
                            None
                        }
                    };
                    send.send_replace(Encoding::Ready(bytes));
                });
                receive
            })
            .clone();
        let ready = result
            .wait_for(|result| matches!(result, Encoding::Ready(_)))
            .await;
        match ready.as_deref() {
            Ok(Encoding::Ready(bytes)) => bytes.clone(),
            _ => None,
        }
    }
}
