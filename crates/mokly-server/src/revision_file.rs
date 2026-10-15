//! Canonical JSON payloads share their bytes while the publication supplies revision.

use axum::body::{Body, Bytes};
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;

use crate::assets::File;
use crate::error::{Result, ServerError};
use crate::response;

/// Immutable slices around a validated top-level revision number.
#[derive(Clone)]
pub struct RevisionFile {
    before: Bytes,
    after: Bytes,
}

impl RevisionFile {
    pub(crate) fn new(file: File) -> Result<Self> {
        let bytes = file.bytes;
        let mut depth = 0;
        let mut quoted = false;
        let mut escaped = false;
        for (offset, byte) in bytes.iter().copied().enumerate() {
            if quoted {
                if escaped {
                    escaped = false;
                } else if byte == b'\\' {
                    escaped = true;
                } else if byte == b'"' {
                    quoted = false;
                }
                continue;
            }
            if depth == 1 && bytes[offset..].starts_with(b"\"revision\":") {
                let value = offset + b"\"revision\":".len();
                let start = value
                    + bytes[value..]
                        .iter()
                        .take_while(|byte| byte.is_ascii_whitespace())
                        .count();
                let end = start
                    + bytes[start..]
                        .iter()
                        .take_while(|b| b.is_ascii_digit())
                        .count();
                if end > start {
                    return Ok(Self {
                        before: bytes.slice(..start),
                        after: bytes.slice(end..),
                    });
                }
            }
            match byte {
                b'"' => quoted = true,
                b'{' | b'[' => depth += 1,
                b'}' | b']' => depth -= 1,
                _ => {}
            }
        }
        Err(ServerError::InvalidAssets)
    }

    pub(crate) fn response(&self, revision: u64) -> Response {
        let before = self.before.clone();
        let after = self.after.clone();
        let revision = Bytes::from(revision.to_string());
        let length = before.len() + revision.len() + after.len();
        let mut response = response::bytes(
            StatusCode::OK,
            "application/json; charset=utf-8",
            Bytes::new(),
        );
        if let Ok(value) = HeaderValue::from_str(&length.to_string()) {
            response.headers_mut().insert("content-length", value);
        }
        *response.body_mut() = Body::from_stream(async_stream::stream! {
            yield Ok::<_, std::convert::Infallible>(before);
            yield Ok(revision);
            yield Ok(after);
        });
        response
    }
}

#[cfg(test)]
#[path = "_tests_/revision_file_tests.rs"]
mod revision_file_tests;
