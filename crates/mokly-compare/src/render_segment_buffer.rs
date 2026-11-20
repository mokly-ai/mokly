//! One fixed allocation holds a segment and its next overflowing record.

use std::mem;

use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::StoreKey;
use mokly_graph::export_memory::ExportObserver;
use sha2::{Digest, Sha256};

use crate::render_segment::{self, MAX_BYTES, MAX_DOCUMENTS};
use crate::render_segment_header;

const HEADER: usize = 32 * 1024;
const PREFIX: usize = 12;
const PAYLOAD: usize = HEADER + PREFIX;
const MAX_WORKSPACE: usize = 4 * 1024 * 1024;

#[derive(Clone, Copy)]
pub(crate) struct Position {
    pub(crate) key: [u8; 64],
    pub(crate) digest: [u8; 32],
    pub(crate) offset: usize,
    pub(crate) bytes: usize,
}

/// Appending either retains the document or preserves it after a full batch.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Append {
    /// The current segment owns the document.
    Added,
    /// Publish the current segment, then carry the already encoded candidate.
    Full,
    /// The document cannot fit or cannot be stored.
    Skipped,
}

/// Immutable metadata and a contiguous envelope borrowed from its fixed owner.
pub struct BuiltSegment<'a> {
    pub(crate) bytes: &'a [u8],
    pub(crate) positions: &'a [Option<Position>],
    pub(crate) header_digest: [u8; 32],
    pub(crate) start: u64,
    pub(crate) payload_bytes: usize,
}

impl BuiltSegment<'_> {
    /// Complete version-one envelope for the unchanged durable storage boundary.
    pub fn bytes(&self) -> &[u8] {
        self.bytes
    }
    /// Number of complete records advertised by the envelope.
    pub fn documents(&self) -> usize {
        self.positions.len()
    }
}

/// Reused only while the cache reservation owns its complete fixed capacity.
pub struct SegmentBuffer {
    bytes: Box<[u8]>,
    positions: [Option<Position>; MAX_DOCUMENTS],
    count: usize,
    payload: usize,
    candidate: Option<Position>,
    target: usize,
}

impl SegmentBuffer {
    /// Allocate once, including room for one complete overflowing candidate.
    pub fn new(target: usize) -> Option<Self> {
        let capacity = Self::workspace_bytes(target)? - mem::size_of::<Self>();
        Some(Self {
            bytes: vec![0; capacity].into_boxed_slice(),
            positions: [None; MAX_DOCUMENTS],
            count: 0,
            payload: 0,
            candidate: None,
            target,
        })
    }

    /// Exact owned byte-buffer capacity and fixed owner size, without allocator rounding.
    pub fn workspace_bytes(target: usize) -> Option<usize> {
        target
            .checked_mul(2)?
            .checked_add(PAYLOAD)?
            .checked_add(mem::size_of::<Self>())
            .filter(|bytes| target > 64 && target <= MAX_BYTES && *bytes <= MAX_WORKSPACE)
    }

    /// Fixed byte-buffer capacity, unchanged by appends, publication, or carry.
    pub fn storage_bytes(&self) -> usize {
        self.bytes.len()
    }

    /// Complete fixed byte capacity and inline owner retained in the workspace.
    pub fn known_bytes(&self) -> usize {
        self.bytes.len() + mem::size_of::<Self>()
    }

    /// Append a complete stored record directly into the fixed allocation.
    pub fn append(
        &mut self,
        key: &StoreKey,
        document: &EncodedView,
        observer: Option<&dyn ExportObserver>,
    ) -> Append {
        if self.candidate.is_some() || !render_segment::valid_key(&key.0) {
            return Append::Skipped;
        }
        let start = PAYLOAD + self.payload;
        let end = start + self.target;
        let Ok(Some(length)) = document.write_stored(&mut self.bytes[start + 64..end], observer)
        else {
            return Append::Skipped;
        };
        self.bytes[start..start + 64].copy_from_slice(key.0.as_bytes());
        let mut key_bytes = [0; 64];
        key_bytes.copy_from_slice(key.0.as_bytes());
        let position = Position {
            key: key_bytes,
            digest: Sha256::digest(&self.bytes[start..start + 64 + length]).into(),
            offset: self.payload,
            bytes: 64 + length,
        };
        if self.count == MAX_DOCUMENTS || self.payload + position.bytes > self.target {
            self.candidate = Some(position);
            Append::Full
        } else {
            self.positions[self.count] = Some(position);
            self.count += 1;
            self.payload += position.bytes;
            Append::Added
        }
    }

    /// Right-align the header before its payload and borrow one contiguous slice.
    pub fn finish(&mut self, version: &str) -> Option<BuiltSegment<'_>> {
        if self.count == 0 {
            return None;
        }
        let (header, payload) = self.bytes.split_at_mut(PAYLOAD);
        let digest = Sha256::digest(&payload[..self.payload]).into();
        let length = render_segment_header::write(
            &mut header[PREFIX..],
            version,
            digest,
            &self.positions[..self.count],
        )?;
        if length + PREFIX + self.payload > MAX_BYTES {
            return None;
        }
        let start = PAYLOAD.checked_sub(length + PREFIX)?;
        header.copy_within(PREFIX..PREFIX + length, start + PREFIX);
        header[start..start + 8].copy_from_slice(b"MKSEG001");
        header[start + 8..start + PREFIX].copy_from_slice(&(length as u32).to_le_bytes());
        Some(BuiltSegment {
            bytes: &self.bytes[start..PAYLOAD + self.payload],
            positions: &self.positions[..self.count],
            header_digest: Sha256::digest(&self.bytes[start + PREFIX..PAYLOAD]).into(),
            start: (PREFIX + length) as u64,
            payload_bytes: self.payload,
        })
    }

    /// Keep a complete candidate when the previous batch has finished publication.
    pub fn advance(&mut self) {
        self.positions.fill(None);
        self.count = 0;
        self.payload = 0;
        if let Some(mut candidate) = self.candidate.take() {
            self.bytes.copy_within(
                PAYLOAD + candidate.offset..PAYLOAD + candidate.offset + candidate.bytes,
                PAYLOAD,
            );
            candidate.offset = 0;
            self.payload = candidate.bytes;
            self.positions[0] = Some(candidate);
            self.count = 1;
        }
    }
}

#[cfg(test)]
#[path = "_tests_/render_segment_buffer_tests.rs"]
mod render_segment_buffer_tests;
