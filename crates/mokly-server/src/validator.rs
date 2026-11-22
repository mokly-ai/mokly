//! Strong SHA-256 entity tags and weak If-None-Match comparison.

use std::io::Read;

use axum::http::header::{CACHE_CONTROL, ETAG, IF_NONE_MATCH};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use sha2::{Digest, Sha256};

use crate::error::{InternalError, Result};
use crate::response;

/// Hash a buffered resource once for its immutable version.
pub(crate) fn bytes(bytes: &[u8]) -> Result<HeaderValue> {
    tag(&Sha256::digest(bytes))
}

/// Hash a captured file with a bounded buffer.
pub(crate) fn reader(reader: &mut dyn Read) -> Result<HeaderValue> {
    let mut buffer = vec![0; 64 * 1024];
    let mut hash = Sha256::new();
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => return tag(&hash.finalize()),
            Ok(length) => hash.update(&buffer[..length]),
            Err(source) => return Err(InternalError::Io { source }.into()),
        }
    }
}

fn tag(hash: &[u8]) -> Result<HeaderValue> {
    let hash: String = hash.iter().map(|byte| format!("{byte:02x}")).collect();
    match HeaderValue::try_from(format!("\"{hash}\"")) {
        Ok(value) => Ok(value),
        Err(source) => Err(InternalError::EntityTag { source }.into()),
    }
}

/// Return 304 for a matching validator. A 200 and a 304 share their cache headers.
pub(crate) fn deliver(
    headers: &HeaderMap,
    tag: HeaderValue,
    body: impl FnOnce() -> Response,
) -> Response {
    let mut response = if matches_tag(headers, &tag) {
        response::empty(StatusCode::NOT_MODIFIED)
    } else {
        body()
    };
    response.headers_mut().insert(ETAG, tag);
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    response
}

fn matches_tag(headers: &HeaderMap, tag: &HeaderValue) -> bool {
    headers.get_all(IF_NONE_MATCH).iter().any(|value| {
        let field = value.as_bytes().trim_ascii();
        let mut quoted = false;
        field == b"*"
            || field
                .split(|&byte| {
                    if byte == b'"' {
                        quoted = !quoted;
                    }
                    byte == b',' && !quoted
                })
                .any(|item| {
                    let item = item.trim_ascii();
                    item.strip_prefix(b"W/").unwrap_or(item) == tag.as_bytes()
                })
    })
}
