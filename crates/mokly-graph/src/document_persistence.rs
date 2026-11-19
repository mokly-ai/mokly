//! Bounded private storage of complete compact documents.

use std::io::{self, Write};
use std::mem;

use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use serde::Deserialize;

use crate::document_annotations::ReferenceRecord;
use crate::document_codec::EncodedView;
use crate::document_error::{CodecInternalError, CodecResult, Result};
use crate::document_metadata::{DocumentMetadata, Metadata};
use crate::document_nodes::FlatNode;
use crate::document_store_metadata::StoredMetadata;
use crate::document_weight;

const PREFIX: usize = 48;
const MAX_RECORD: usize = 2 * 1024 * 1024;
const MAX_RESTORE: usize = 16 * 1024 * 1024;

fn valid(bytes: usize, tree: usize, records: usize, metadata: usize) -> bool {
    records <= tree
        && records
            .checked_mul(mem::size_of::<FlatNode>())
            .and_then(|value| value.checked_add(bytes))
            .and_then(|value| value.checked_add(tree))
            .and_then(|value| value.checked_add(metadata.saturating_mul(8)))
            .is_some_and(|value| value <= MAX_RESTORE)
}

impl EncodedView {
    /// Encode complete metadata and compressed bytes under an exact byte bound.
    pub fn stored(&self, limit: usize) -> Result<Option<Vec<u8>>> {
        let limit = limit.min(MAX_RECORD);
        if self.metadata_bytes > limit
            || !valid(
                self.bytes_len,
                self.tree_len,
                self.record_count,
                self.metadata_bytes,
            )
        {
            return Ok(None);
        }
        let Some(metadata) = StoredMetadata::new(self) else {
            return Ok(None);
        };
        let mut writer = Limited {
            bytes: vec![0; PREFIX],
            limit,
            exceeded: false,
        };
        if PREFIX > limit {
            return Ok(None);
        }
        if let Err(source) = serde_json::to_writer(&mut writer, &metadata) {
            if writer.exceeded {
                return Ok(None);
            }
            return Err(CodecInternalError::Metadata { source }.into());
        }
        let metadata_len = writer.bytes.len() - PREFIX;
        if writer.write_all(&self.payload).is_err() {
            return Ok(None);
        }
        writer.bytes[..8].copy_from_slice(b"MKDOC001");
        for (slot, value) in [
            self.bytes_len,
            self.tree_len,
            self.record_count,
            metadata_len,
            self.payload.len(),
        ]
        .into_iter()
        .enumerate()
        {
            writer.bytes[8 + slot * 8..16 + slot * 8]
                .copy_from_slice(&(value as u64).to_le_bytes());
        }
        Ok(Some(writer.bytes))
    }

    /// Decode checked private data before restoring any document allocation.
    pub fn from_stored(bytes: &[u8]) -> Result<Self> {
        if bytes.len() < PREFIX || bytes.len() > MAX_RECORD || &bytes[..8] != b"MKDOC001" {
            return Err(CodecInternalError::InvalidLength.into());
        }
        let mut lengths = [0usize; 5];
        for (index, slot) in lengths.iter_mut().enumerate() {
            let mut value = [0; 8];
            value.copy_from_slice(&bytes[8 + index * 8..16 + index * 8]);
            let Ok(value) = usize::try_from(u64::from_le_bytes(value)) else {
                return Err(CodecInternalError::InvalidLength.into());
            };
            *slot = value;
        }
        let [bytes_len, tree_len, record_count, metadata_len, payload_len] = lengths;
        if !valid(bytes_len, tree_len, record_count, metadata_len)
            || PREFIX
                .checked_add(metadata_len)
                .and_then(|size| size.checked_add(payload_len))
                != Some(bytes.len())
        {
            return Err(CodecInternalError::InvalidLength.into());
        }
        let metadata_bytes = &bytes[PREFIX..PREFIX + metadata_len];
        if !bounded_json(metadata_bytes) {
            return Err(CodecInternalError::InvalidLength.into());
        }
        let mut decoder = serde_json::Deserializer::from_slice(metadata_bytes);
        decoder.disable_recursion_limit();
        let metadata = StoredMetadata::deserialize(&mut decoder).codec()?;
        decoder.end().codec()?;
        let warnings = metadata
            .warnings
            .into_iter()
            .map(|warning| warning.restore())
            .collect::<Option<Vec<_>>>()
            .ok_or(CodecInternalError::InvalidLength)?;
        let document = Composed {
            tree: vec![],
            usage: metadata.usage.into(),
            resources: metadata.resources,
            components: metadata.components,
            links: metadata.links.into_iter().map(Reference::from).collect(),
            warnings,
        };
        let metadata_bytes = document_weight::metadata(&document);
        if !valid(bytes_len, tree_len, record_count, metadata_bytes) {
            return Err(CodecInternalError::InvalidLength.into());
        }
        Ok(Self {
            payload: bytes[PREFIX + metadata_len..].into(),
            bytes_len,
            tree_len,
            record_count,
            metadata: Metadata {
                content_type: metadata.content_type,
                document: Some(DocumentMetadata {
                    usage: document.usage,
                    warnings: document.warnings,
                    resources: document.resources,
                    components: document.components,
                    links: document.links.iter().map(ReferenceRecord::from).collect(),
                }),
            },
            metadata_bytes,
        })
    }
}

fn bounded_json(bytes: &[u8]) -> bool {
    let mut depth = 0usize;
    let mut quoted = false;
    let mut escaped = false;
    for byte in bytes {
        if quoted {
            if escaped {
                escaped = false;
            } else if *byte == b'\\' {
                escaped = true;
            } else if *byte == b'"' {
                quoted = false;
            }
        } else {
            match byte {
                b'"' => quoted = true,
                b'[' | b'{' => {
                    depth += 1;
                    if depth > 256 {
                        return false;
                    }
                }
                b']' | b'}' => {
                    let Some(value) = depth.checked_sub(1) else {
                        return false;
                    };
                    depth = value;
                }
                _ => {}
            }
        }
    }
    !quoted && depth == 0
}

struct Limited {
    bytes: Vec<u8>,
    limit: usize,
    exceeded: bool,
}
impl Write for Limited {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if bytes.len() > self.limit.saturating_sub(self.bytes.len()) {
            self.exceeded = true;
            return Err(io::Error::other(CodecInternalError::InvalidLength));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
