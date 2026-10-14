//! Bounded newline-delimited UTF-8 JSON framing.

use serde::Serialize;

use crate::error::{Error, ProtocolError, Result};
use crate::wire::Frame;

/// Maximum bytes of JSON in one frame, excluding its LF delimiter.
pub const MAX_FRAME_BYTES: usize = 64 * 1024 * 1024;

/// Incremental decoder; it never retains more than one bounded partial frame.
#[derive(Default)]
pub struct Decoder {
    pending: Vec<u8>,
}

impl Decoder {
    /// Decode arbitrary transport chunks, including split UTF-8 characters.
    /// Protocol failures invalidate this decoder and its associated sidecar.
    pub fn push(&mut self, chunk: &[u8]) -> Result<Vec<Frame>> {
        let mut frames = Vec::new();
        for part in chunk.split_inclusive(|byte| *byte == b'\n') {
            let complete = part.last() == Some(&b'\n');
            let content = if complete {
                &part[..part.len() - 1]
            } else {
                part
            };
            if self.pending.len().saturating_add(content.len()) > MAX_FRAME_BYTES {
                return Err(Error::Protocol(ProtocolError::Oversized {
                    limit: MAX_FRAME_BYTES,
                }));
            }
            self.pending.extend_from_slice(content);
            if complete {
                let frame = match serde_json::from_slice(&self.pending) {
                    Ok(frame) => frame,
                    Err(source) => return Err(Error::Protocol(ProtocolError::Json { source })),
                };
                frames.push(frame);
                self.pending.clear();
            }
        }
        Ok(frames)
    }

    /// Reject EOF in the middle of a frame.
    pub fn finish(&self) -> Result<()> {
        if self.pending.is_empty() {
            Ok(())
        } else {
            Err(Error::Protocol(ProtocolError::Truncated))
        }
    }
}

/// Encode one frame and append LF after checking the UTF-8 byte size.
pub fn encode(value: &impl Serialize) -> Result<Vec<u8>> {
    let mut bytes = match serde_json::to_vec(value) {
        Ok(bytes) => bytes,
        Err(source) => return Err(Error::Protocol(ProtocolError::Json { source })),
    };
    if bytes.len() > MAX_FRAME_BYTES {
        return Err(Error::Protocol(ProtocolError::Oversized {
            limit: MAX_FRAME_BYTES,
        }));
    }
    bytes.push(b'\n');
    Ok(bytes)
}

#[cfg(test)]
#[path = "_tests_/codec_tests.rs"]
mod codec_tests;
