//! Uniform response headers and public error envelopes.

use axum::body::Body;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use serde::Serialize;
use tokio::io::AsyncReadExt;

use crate::public_read::OpenedFile;

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

pub(crate) fn stream(opened: OpenedFile) -> Response {
    let mut response = bytes(StatusCode::OK, &opened.content_type, Vec::new());
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
