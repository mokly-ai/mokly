//! Canonical JSON payloads share their bytes while the publication supplies revision.

use axum::body::Bytes;
#[cfg(test)]
use axum::response::Response;

use crate::assets::File;
use crate::json_delivery::JsonBody;

/// Immutable slices around an encoded Serve record's top-level revision number.
#[derive(Clone)]
pub struct RevisionFile {
    before: Bytes,
    after: Bytes,
}

impl RevisionFile {
    pub(crate) fn new(file: File) -> Self {
        let bytes = file.bytes;
        let (start, end) = revision_range(&bytes)
            .expect("Serve indexes and current details always encode a numeric revision");
        Self {
            before: bytes.slice(..start),
            after: bytes.slice(end..),
        }
    }

    /// Pair the immutable payload slices with the current publication's revision.
    pub(crate) fn body(&self, revision: u64) -> JsonBody {
        JsonBody::Revision([
            self.before.clone(),
            Bytes::from(revision.to_string()),
            self.after.clone(),
        ])
    }

    #[cfg(test)]
    pub(crate) fn response(&self, revision: u64) -> Response {
        self.body(revision).response(None)
    }
}

fn revision_range(bytes: &[u8]) -> Option<(usize, usize)> {
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
                return Some((start, end));
            }
        }
        match byte {
            b'"' => quoted = true,
            b'{' | b'[' => depth += 1,
            b'}' | b']' => depth -= 1,
            _ => {}
        }
    }
    None
}

#[cfg(test)]
#[path = "_tests_/revision_file_tests.rs"]
mod revision_file_tests;
