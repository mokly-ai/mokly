//! Bounded asynchronous-to-synchronous body bridge with backpressure.

use std::io::{self, Cursor, Read};
use std::sync::Arc;

use axum::body::Body;
use bytes::Bytes;
use http_body_util::BodyExt;
use tokio::sync::mpsc::{Receiver, Sender};

use crate::error::{ApiError, Result};
use crate::upload_error::UploadError;
use crate::upload_outcome::UploadTransport;

pub(crate) const COMPRESSED_LIMIT: usize = 100 * 1024 * 1024;

pub(crate) enum BodyChunk {
    Data(Bytes),
    Complete,
}

/// Synchronous reader over the body channel. A body ends cleanly only when
/// the pump sent `Complete`; a closed channel is an unexpected EOF, so a
/// disconnect, a transport error or a limit never reads as a complete body.
pub(crate) struct ChannelReader {
    pub(crate) receiver: Receiver<BodyChunk>,
    pub(crate) current: Cursor<Bytes>,
    pub(crate) complete: bool,
}

impl Read for ChannelReader {
    fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
        if output.is_empty() {
            return Ok(0);
        }
        loop {
            let read = self.current.read(output)?;
            if read != 0 {
                return Ok(read);
            }
            if self.complete {
                return Ok(0);
            }
            match self.receiver.blocking_recv() {
                Some(BodyChunk::Data(bytes)) => self.current = Cursor::new(bytes),
                Some(BodyChunk::Complete) => self.complete = true,
                None => {
                    return Err(io::Error::new(
                        io::ErrorKind::UnexpectedEof,
                        "incomplete HTTP body",
                    ));
                }
            }
        }
    }
}

/// Forward body frames into the channel in bounded chunks. The pump stops,
/// without an error, as soon as the reader side is dropped, so an early
/// rejection stops consuming the HTTP body.
pub(crate) trait BodyPump {
    async fn pump(
        self,
        sender: Sender<BodyChunk>,
        transport: Option<Arc<dyn UploadTransport>>,
    ) -> Result<()>;
}

impl BodyPump for Body {
    async fn pump(
        mut self,
        sender: Sender<BodyChunk>,
        transport: Option<Arc<dyn UploadTransport>>,
    ) -> Result<()> {
        let mut received = 0_usize;
        while let Some(frame) = self.frame().await {
            let frame = match frame {
                Ok(frame) => frame,
                Err(_) => {
                    if let Some(transport) = transport {
                        transport.abandoned();
                    }
                    return Err(ApiError::Upload(UploadError::InvalidBundle));
                }
            };
            let Ok(bytes) = frame.into_data() else {
                continue;
            };
            received = received.saturating_add(bytes.len());
            if received > COMPRESSED_LIMIT {
                return Err(ApiError::Upload(UploadError::TooLarge));
            }
            for chunk in bytes.chunks(64 * 1024) {
                if sender
                    .send(BodyChunk::Data(Bytes::copy_from_slice(chunk)))
                    .await
                    .is_err()
                {
                    return Ok(());
                }
            }
        }
        let _ = sender.send(BodyChunk::Complete).await;
        Ok(())
    }
}

/// Forward exactly `length` body bytes into a bounded channel.
pub(crate) async fn pump_exact(
    mut body: Body,
    sender: Sender<BodyChunk>,
    length: u64,
    transport: Option<Arc<dyn UploadTransport>>,
) -> Result<()> {
    let mut received = 0_u64;
    while let Some(frame) = body.frame().await {
        let frame = match frame {
            Ok(frame) => frame,
            Err(_) => {
                if let Some(transport) = transport {
                    transport.abandoned();
                }
                return Err(ApiError::Upload(UploadError::InvalidBundle));
            }
        };
        let Ok(bytes) = frame.into_data() else {
            continue;
        };
        received = received.saturating_add(bytes.len() as u64);
        if received > length {
            return Err(ApiError::Upload(UploadError::InvalidBundle));
        }
        for chunk in bytes.chunks(64 * 1024) {
            if sender
                .send(BodyChunk::Data(Bytes::copy_from_slice(chunk)))
                .await
                .is_err()
            {
                return Ok(());
            }
        }
    }
    if received != length {
        return Err(ApiError::Upload(UploadError::InvalidBundle));
    }
    let _ = sender.send(BodyChunk::Complete).await;
    Ok(())
}

#[cfg(test)]
#[path = "_tests_/upload_stream_tests.rs"]
mod tests;
