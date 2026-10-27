//! Prepare an immutable Blob request body for one Plan round.

use std::io::Write;

use bytes::Bytes;
use flate2::{Compression, GzBuilder};

use crate::error::{Error, InternalError, Result};
use crate::http::Encoding;
use crate::runtime::Cancellation;

/// Encode a file when gzip produces a strictly smaller request body.
pub(crate) fn encode(bytes: &Bytes) -> Result<(Bytes, Encoding)> {
    let mut encoder = GzBuilder::new()
        .mtime(0)
        .write(Vec::new(), Compression::default());
    if let Err(source) = encoder.write_all(bytes) {
        return Err(Error::Internal(InternalError::Encoding { source }));
    }
    let compressed = match encoder.finish() {
        Ok(bytes) => bytes,
        Err(source) => return Err(Error::Internal(InternalError::Encoding { source })),
    };
    if compressed.len() < bytes.len() {
        Ok((compressed.into(), Encoding::Gzip))
    } else {
        Ok((bytes.clone(), Encoding::Identity))
    }
}

/// Prepare a Blob body and observe command cancellation while gzip runs.
pub(crate) async fn prepare(
    bytes: Bytes,
    encoding: Encoding,
    cancellation: &dyn Cancellation,
) -> Result<(Bytes, Encoding)> {
    if encoding == Encoding::Identity {
        return Ok((bytes, Encoding::Identity));
    }
    let task = tokio::task::spawn_blocking(move || encode(&bytes));
    tokio::select! {
        biased;
        () = cancellation.cancelled() => Err(Error::Cancelled),
        result = task => match result {
            Ok(result) => result,
            Err(source) => Err(Error::Internal(InternalError::BlockingTask { source })),
        },
    }
}
