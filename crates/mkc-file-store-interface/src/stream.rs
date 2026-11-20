//! Validated byte ranges and bounded immutable-object streams.

use std::io;
use std::mem;
use std::pin::Pin;

use async_stream::try_stream;
use bytes::Bytes;
use futures_util::{Stream, StreamExt};
use mkc_domain::blob::{BlobHash, BlobKey};
use sha2::{Digest, Sha256};

use crate::error::{Error, IntegrityError, Result};
use crate::store::MAX_FILE_BYTES;

/// A sendable asynchronous stream of immutable object bytes.
pub type BlobBody = Pin<Box<dyn Stream<Item = io::Result<Bytes>> + Send>>;

/// An inclusive satisfiable byte range tied to one object length.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ByteRange {
    start: u64,
    end: u64,
    total_length: u64,
}

impl ByteRange {
    /// Validate inclusive offsets against a nonempty object.
    pub fn new(start: u64, end: u64, total_length: u64) -> Option<Self> {
        (start <= end && end < total_length).then_some(Self {
            start,
            end,
            total_length,
        })
    }

    /// Inclusive first byte offset.
    pub fn start(self) -> u64 {
        self.start
    }

    /// Inclusive final byte offset.
    pub fn end(self) -> u64 {
        self.end
    }

    /// Length of the object against which this range was validated.
    pub fn total_length(self) -> u64 {
        self.total_length
    }

    /// Number of selected bytes.
    pub fn length(self) -> u64 {
        self.end - self.start + 1
    }
}

/// One bounded object body and the metadata needed to frame its response.
pub struct BlobStream {
    total_length: u64,
    served_range: Option<ByteRange>,
    body: BlobBody,
}

impl BlobStream {
    /// Wrap a complete object with incremental length and SHA-256 verification.
    pub fn full(key: &BlobKey, total_length: u64, body: BlobBody) -> Result<Self> {
        if total_length > MAX_FILE_BYTES {
            return Err(Error::internal(IntegrityError::TooLarge));
        }
        Ok(Self {
            total_length,
            served_range: None,
            body: verifying_body(body, key.hash.clone(), total_length),
        })
    }

    /// Wrap an exact range whose offsets were validated against this object.
    pub fn ranged(total_length: u64, range: ByteRange, body: BlobBody) -> Result<Self> {
        if total_length > MAX_FILE_BYTES {
            return Err(Error::internal(IntegrityError::TooLarge));
        }
        if range.total_length() != total_length {
            return Err(Error::internal(IntegrityError::LengthMismatch));
        }
        Ok(Self {
            total_length,
            served_range: Some(range),
            body: exact_length_body(body, range.length()),
        })
    }

    /// Total length of the immutable object, before range selection.
    pub fn total_length(&self) -> u64 {
        self.total_length
    }

    /// Selected range, or `None` when the complete object is served.
    pub fn served_range(&self) -> Option<ByteRange> {
        self.served_range
    }

    /// Consume the metadata wrapper and return its bounded byte stream.
    pub fn into_body(self) -> BlobBody {
        self.body
    }
}

/// Emit exactly `length` bytes and fail when the provider ends early; a ranged
/// body cannot recompute the whole digest, so it relies on the provider.
fn exact_length_body(mut inner: BlobBody, length: u64) -> BlobBody {
    Box::pin(try_stream! {
        let mut remaining = length;
        while remaining > 0 {
            let Some(item) = inner.next().await else {
                Err(integrity_error(IntegrityError::LengthMismatch))?;
                break;
            };
            let bytes = item?;
            if bytes.is_empty() {
                continue;
            }
            let emitted = bytes.len().min(remaining as usize);
            remaining -= emitted as u64;
            yield bytes.slice(..emitted);
        }
    })
}

/// Hash each chunk as it flows and withhold the final byte until EOF proves the
/// length and digest, so a reader can receive a prefix but never a complete
/// corrupt body; an empty body verifies at EOF.
fn verifying_body(mut inner: BlobBody, expected_hash: BlobHash, expected_length: u64) -> BlobBody {
    Box::pin(try_stream! {
        let mut observed = 0_u64;
        let mut hasher = Sha256::new();
        let mut pending = None;
        while let Some(item) = inner.next().await {
            let bytes = item?;
            if bytes.is_empty() {
                continue;
            }
            observed = observed
                .checked_add(bytes.len() as u64)
                .ok_or_else(|| integrity_error(IntegrityError::LengthMismatch))?;
            if observed > expected_length {
                Err(integrity_error(IntegrityError::LengthMismatch))?;
            }
            hasher.update(&bytes);
            if let Some(byte) = pending.replace(bytes[bytes.len() - 1]) {
                yield Bytes::copy_from_slice(&[byte]);
            }
            if bytes.len() > 1 {
                yield bytes.slice(..bytes.len() - 1);
            }
        }
        if observed != expected_length {
            Err(integrity_error(IntegrityError::LengthMismatch))?;
        }
        let digest = mem::take(&mut hasher).finalize();
        if !digest_matches(&digest, &expected_hash) {
            Err(integrity_error(IntegrityError::DigestMismatch))?;
        }
        if let Some(byte) = pending {
            yield Bytes::copy_from_slice(&[byte]);
        }
    })
}

fn integrity_error(error: IntegrityError) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, error)
}

fn digest_matches(digest: &[u8], expected: &BlobHash) -> bool {
    let expected = expected.as_str().as_bytes();
    digest.iter().enumerate().all(|(index, byte)| {
        expected[index * 2] == hex_digit(byte >> 4)
            && expected[index * 2 + 1] == hex_digit(byte & 0x0f)
    })
}

fn hex_digit(nibble: u8) -> u8 {
    match nibble {
        0..=9 => b'0' + nibble,
        _ => b'a' + nibble - 10,
    }
}

#[cfg(test)]
#[path = "_tests_/stream_tests.rs"]
mod tests;
