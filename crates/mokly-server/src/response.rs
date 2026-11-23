//! Uniform response headers and public error envelopes.

use crate::json_delivery;
use crate::render_request::Rejection;
use axum::body::{Body, Bytes};
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use serde::Serialize;

#[derive(Serialize)]
struct PublicError {
    code: &'static str,
    message: &'static str,
}

pub(crate) fn bytes(status: StatusCode, content_type: &str, bytes: Bytes) -> Response {
    let length = bytes.len();
    let mut response = Response::new(Body::from(bytes));
    *response.status_mut() = status;
    if is_json(content_type) {
        response.headers_mut().insert(
            "content-type",
            HeaderValue::from_static(json_delivery::CONTENT_TYPE),
        );
        json_delivery::vary(&mut response);
    } else if let Ok(value) = HeaderValue::from_str(content_type) {
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

/// Whether a stored file has a JSON media type, with or without a charset.
pub(crate) fn is_json(content_type: &str) -> bool {
    let mime = content_type
        .split_once(';')
        .map_or(content_type, |(mime, _)| mime);
    mime.trim().eq_ignore_ascii_case("application/json")
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
    let bytes = serde_json::to_vec(&PublicError { code, message })
        .expect("PublicError contains only two string fields");
    self::bytes(status, "application/json; charset=utf-8", bytes.into())
}

pub(crate) fn missing() -> Response {
    error(
        StatusCode::NOT_FOUND,
        "not-found",
        "The requested file was not found.",
    )
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
