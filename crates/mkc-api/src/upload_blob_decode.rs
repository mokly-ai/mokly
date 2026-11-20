//! Bounded gzip Blob decoding over the request body channel.

use std::io::{BufReader, Cursor, Read};
use std::sync::Arc;

use axum::body::Body;
use bytes::Bytes;
use flate2::bufread::GzDecoder;
use mkc_upload_memory_interface::budget::UploadMemoryReservation;
use tokio::sync::mpsc;

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::upload_error::UploadError;
use crate::upload_outcome::UploadTransport;
use crate::upload_stream::{BodyChunk, ChannelReader, pump_exact};

use crate::upload_blob::RECEPTION;

/// Decode one gzip Blob while retaining its encoded reservation until the
/// encoded body has been fully consumed.
pub(crate) async fn receive(
    body: Body,
    encoded_length: u64,
    decoded_length: u64,
    encoded_reservation: Arc<dyn UploadMemoryReservation>,
    transport: Option<Arc<dyn UploadTransport>>,
) -> Result<Vec<u8>> {
    let (sender, receiver) = mpsc::channel(2);
    let mut worker = tokio::task::spawn_blocking(move || decode(receiver, decoded_length));
    let pump = tokio::time::timeout(
        RECEPTION,
        pump_exact(body, sender, encoded_length, transport),
    );
    let result = tokio::select! {
        result = &mut worker => result.context("join gzip Blob decoder")?,
        result = pump => {
            match result {
                Ok(Ok(())) => (),
                Ok(Err(error)) => return Err(error),
                Err(_) => return Err(ApiError::Upload(UploadError::Timeout)),
            }
            worker.await.context("finish gzip Blob decoder")?
        }
    };
    let _encoded_reservation = encoded_reservation;
    result
}

fn decode(receiver: mpsc::Receiver<BodyChunk>, decoded_length: u64) -> Result<Vec<u8>> {
    let capacity = usize::try_from(decoded_length).context("size decoded Blob")?;
    let maximum = capacity
        .checked_add(1)
        .ok_or(ApiError::Upload(UploadError::InvalidBundle))?;
    let channel = ChannelReader {
        receiver,
        current: Cursor::new(Bytes::new()),
        complete: false,
    };
    let mut input = BufReader::new(channel);
    let mut decoder = GzDecoder::new(&mut input);
    let mut bytes = Vec::with_capacity(capacity);
    let mut chunk = [0_u8; 64 * 1024];
    loop {
        let remaining = maximum.saturating_sub(bytes.len());
        if remaining == 0 {
            return Err(ApiError::Upload(UploadError::InvalidBundle));
        }
        let chunk_len = chunk.len().min(remaining);
        let read = decoder
            .read(&mut chunk[..chunk_len])
            .map_err(|_| ApiError::Upload(UploadError::InvalidBundle))?;
        if read == 0 {
            break;
        }
        if bytes.len().saturating_add(read) > maximum {
            return Err(ApiError::Upload(UploadError::InvalidBundle));
        }
        bytes.extend_from_slice(&chunk[..read]);
        if bytes.len() > capacity {
            return Err(ApiError::Upload(UploadError::InvalidBundle));
        }
    }
    drop(decoder);
    let mut trailing = [0_u8; 1];
    if input
        .read(&mut trailing)
        .map_err(|_| ApiError::Upload(UploadError::InvalidBundle))?
        != 0
    {
        return Err(ApiError::Upload(UploadError::InvalidBundle));
    }
    if bytes.len() != capacity {
        return Err(ApiError::Upload(UploadError::InvalidBundle));
    }
    Ok(bytes)
}
