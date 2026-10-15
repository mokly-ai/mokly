//! Uniform response headers and public error envelopes.

use axum::body::Body;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use serde::Serialize;

#[derive(Serialize)]
struct PublicError {
    code: &'static str,
    message: &'static str,
}

pub(crate) fn bytes(status: StatusCode, content_type: &str, bytes: Vec<u8>) -> Response {
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

pub(crate) fn error(status: StatusCode, code: &'static str, message: &'static str) -> Response {
    let bytes = serde_json::to_vec(&PublicError { code, message }).unwrap_or_default();
    self::bytes(status, "application/json; charset=utf-8", bytes)
}

pub(crate) fn missing() -> Response {
    error(
        StatusCode::NOT_FOUND,
        "not-found",
        "The requested file was not found.",
    )
}
