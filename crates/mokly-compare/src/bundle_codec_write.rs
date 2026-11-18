//! Encode bounded files and measure the exact disk seed request before writes.

use std::io::{self, Write};

use mokly_sidecar::durable_recipe::DurableRecipe;
use mokly_sidecar::reusable_recipe::disk_seed_request;
use serde::Serialize;
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::bundle_codec::{
    Codec, HEADER_BYTES, Header, StoredBundle, StoredKind, StoredRecipe, hex,
};
use crate::error::{InternalError, Result};

impl Codec {
    pub(crate) fn encode(&self, recipe: &DurableRecipe, version: &str) -> Result<Option<Vec<u8>>> {
        let mut header = Header {
            format_version: 1,
            mokly_version: version.into(),
            payload_digest: "0".repeat(64),
        };
        let Some(prefix) = encode_bounded(&header, HEADER_BYTES)? else {
            return Ok(None);
        };
        let mut writer = LimitedWriter {
            bytes: prefix,
            limit: self.file_bytes,
            exceeded: false,
        };
        if writer.write_all(b"\n").is_err() {
            return Ok(None);
        }
        let payload_start = writer.bytes.len();
        let stored = StoredBundle {
            kind: StoredKind::Bundles,
            recipe: StoredRecipe {
                generation: recipe.generation(),
                params: recipe.params(),
                modules: recipe.modules(),
                compiled: recipe.compiled(),
            },
        };
        if let Err(source) = serde_json::to_writer(&mut writer, &stored) {
            if writer.exceeded {
                return Ok(None);
            }
            return Err(InternalError::Json { source }.into());
        }
        header.payload_digest = hex(&Sha256::digest(&writer.bytes[payload_start..]));
        let Some(prefix) = encode_bounded(&header, HEADER_BYTES)? else {
            return Ok(None);
        };
        writer.bytes[..prefix.len()].copy_from_slice(&prefix);
        let mut measured = Counter {
            bytes: 0,
            limit: self.frame_bytes,
            exceeded: false,
        };
        if let Err(source) = serde_json::to_writer(&mut measured, &disk_seed_request(recipe)) {
            if measured.exceeded {
                return Ok(None);
            }
            return Err(InternalError::Json { source }.into());
        }
        Ok(Some(writer.bytes))
    }
}

fn encode_bounded(value: &impl Serialize, limit: usize) -> Result<Option<Vec<u8>>> {
    let mut writer = LimitedWriter {
        bytes: vec![],
        limit,
        exceeded: false,
    };
    match serde_json::to_writer(&mut writer, value) {
        Ok(()) => Ok(Some(writer.bytes)),
        Err(_) if writer.exceeded => Ok(None),
        Err(source) => Err(InternalError::Json { source }.into()),
    }
}

#[derive(Debug, Error)]
#[error("[mokly-compare/bundle-codec] encoded bytes exceed the internal bound")]
struct LimitReached;

struct LimitedWriter {
    bytes: Vec<u8>,
    limit: usize,
    exceeded: bool,
}

impl Write for LimitedWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if self.bytes.len().saturating_add(bytes.len()) > self.limit {
            self.exceeded = true;
            return Err(io::Error::other(LimitReached));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

struct Counter {
    bytes: usize,
    limit: usize,
    exceeded: bool,
}

impl Write for Counter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.bytes = self.bytes.saturating_add(bytes.len());
        if self.bytes > self.limit {
            self.exceeded = true;
            return Err(io::Error::other(LimitReached));
        }
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
