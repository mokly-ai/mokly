//! Uniform response headers and public error envelopes.

use axum::body::{Body, Bytes};
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use serde::Serialize;
use tokio::io::AsyncReadExt;

use crate::public_read::OpenedFile;
use crate::render_request::Rejection;

#[derive(Serialize)]
struct PublicError {
    code: &'static str,
    message: &'static str,
}

pub(crate) fn bytes(status: StatusCode, content_type: &str, bytes: Bytes) -> Response {
    let length = bytes.len();
    let mut response = Response::new(Body::from(bytes));
    *response.status_mut() = status;
    if let Ok(value) = HeaderValue::from_str(content_type) {
        response.headers_mut().insert("content-type", value);
    }
    if let Ok(value) = HeaderValue::from_str(&length.to_string()) {
        response.headers_mut().insert("content-length", value);
    }
    response
        .headers_mut()
        .insert("cache-control", HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    response
}

/// A bodiless answer, such as a redirect or a 204, with the uniform caching and sniffing headers.
pub(crate) fn empty(status: StatusCode) -> Response {
    let mut response = Response::new(Body::empty());
    *response.status_mut() = status;
    response
        .headers_mut()
        .insert("cache-control", HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    response
}

pub(crate) fn error(status: StatusCode, code: &'static str, message: &'static str) -> Response {
    let bytes = serde_json::to_vec(&PublicError { code, message }).unwrap_or_default();
    self::bytes(status, "application/json; charset=utf-8", bytes.into())
}

pub(crate) fn missing() -> Response {
    error(
        StatusCode::NOT_FOUND,
        "not-found",
        "The requested file was not found.",
    )
}

pub(crate) fn stream(opened: OpenedFile) -> Response {
    let mut response = bytes(StatusCode::OK, &opened.content_type, Bytes::new());
    if let Ok(value) = HeaderValue::from_str(&opened.length.to_string()) {
        response.headers_mut().insert("content-length", value);
    }
    let mut file = tokio::fs::File::from_std(opened.file).take(opened.length);
    let chunks = async_stream::stream! {
        let mut buffer = vec![0; 64 * 1024];
        loop {
            match file.read(&mut buffer).await {
                Ok(0) => break,
                Ok(length) => yield Ok::<_, std::io::Error>(axum::body::Bytes::copy_from_slice(&buffer[..length])),
                Err(error) => { yield Err(error); break; }
            }
        }
    };
    *response.body_mut() = Body::from_stream(chunks);
    response
}

pub(crate) fn method(allow: &'static str) -> Response {
    let mut response = self::error(
        StatusCode::METHOD_NOT_ALLOWED,
        "method",
        "The request method is not supported.",
    );
    response
        .headers_mut()
        .insert("allow", HeaderValue::from_static(allow));
    response
}
pub(crate) fn reject(rejection: Rejection) -> Response {
    let (status, code, message) = match rejection {
        Rejection::InvalidInput => (
            StatusCode::BAD_REQUEST,
            "invalid-input",
            "Check the prop values and their allowed limits.",
        ),
        Rejection::UnknownEntry => (
            StatusCode::NOT_FOUND,
            "unknown-entry",
            "This entry is unavailable.",
        ),
        Rejection::StaleRevision => (
            StatusCode::CONFLICT,
            "stale-revision",
            "The catalogue changed. Try again.",
        ),
        Rejection::RenderFailed => (
            StatusCode::UNPROCESSABLE_ENTITY,
            "render-failed",
            "The preview could not be rendered. Try again or reset the props.",
        ),
        Rejection::Capacity => (
            StatusCode::TOO_MANY_REQUESTS,
            "capacity",
            "The renderer is busy. Try again shortly.",
        ),
    };
    self::error(status, code, message)
}
