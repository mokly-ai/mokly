//! Lossless compressed documents shared by render-cache eviction and comparison capture.

use std::io::{self, BufWriter, Read, Write};
use std::mem;

use flate2::Compression;
use flate2::bufread::ZlibDecoder;
use flate2::write::ZlibEncoder;
use mokly_model::usage::CatalogueUsage;
use serde::Serialize;

use crate::cache::Artifact;
use crate::comparison_proof::ContentIdentity;
use crate::document_error::{CodecInternalError, CodecResult, Result};
use crate::document_identity::IdentityWriter;
use crate::document_metadata::Metadata;
use crate::document_nodes::{self, FlatNode};
use crate::document_weight;
use crate::document_writer::TreeWriter;

#[derive(Serialize)]
struct Payload {
    tree: Vec<FlatNode>,
}

/// Immutable compressed tree/bytes with Rust metadata outside the codec.
pub struct EncodedView {
    pub(crate) payload: Box<[u8]>,
    pub(crate) bytes_len: usize,
    pub(crate) tree_len: usize,
    pub(crate) record_count: usize,
    pub(crate) metadata: Metadata,
    pub(crate) metadata_bytes: usize,
}

impl EncodedView {
    /// Encode one validated document and retain its complete metadata.
    pub fn encode(artifact: &Artifact) -> Result<Self> {
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
        let (tree_len, record_count) = {
            let mut writer = BufWriter::new(&mut encoder);
            Self::write_payload(artifact, &mut writer)?
        };
        Ok(Self::from_payload(
            artifact,
            Metadata::capture(artifact),
            encoder.finish().codec()?,
            tree_len,
            record_count,
        ))
    }

    /// Encode and hash exact bytes, annotated flat records, and all retained metadata.
    /// Only the caller retains the identity; ordinary cache encoding adds no digest.
    pub fn encode_identified(artifact: &Artifact) -> Result<(Self, ContentIdentity)> {
        let metadata = Metadata::capture(artifact);
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
        let (tree_len, record_count, identity) = {
            let mut writer = IdentityWriter::new(&mut encoder, artifact.bytes.len());
            let (tree_len, record_count) = {
                let mut buffered = BufWriter::new(&mut writer);
                Self::write_payload(artifact, &mut buffered)?
            };
            (tree_len, record_count, writer.finish(tree_len, &metadata)?)
        };
        Ok((
            Self::from_payload(
                artifact,
                metadata,
                encoder.finish().codec()?,
                tree_len,
                record_count,
            ),
            identity,
        ))
    }

    /// Hash a checked artifact through the same lossless codec input as capture.
    pub fn comparison_identity(artifact: &Artifact) -> Result<ContentIdentity> {
        let metadata = Metadata::capture(artifact);
        let mut sink = io::sink();
        let mut writer = IdentityWriter::new(&mut sink, artifact.bytes.len());
        let (tree_len, _) = {
            let mut buffered = BufWriter::new(&mut writer);
            Self::write_payload(artifact, &mut buffered)?
        };
        writer.finish(tree_len, &metadata)
    }

    /// Reuse a charged cache encoder, including its serialization buffer.
    pub(crate) fn encode_pooled(
        artifact: &Artifact,
        writer: &mut BufWriter<ZlibEncoder<Vec<u8>>>,
    ) -> Result<Self> {
        let result = Self::write_payload(artifact, writer);
        if result.is_err() {
            writer.flush().codec()?;
        }
        let payload = writer.get_mut().reset(Vec::new()).codec()?;
        let (tree_len, record_count) = result?;
        Ok(Self::from_payload(
            artifact,
            Metadata::capture(artifact),
            payload,
            tree_len,
            record_count,
        ))
    }

    fn write_payload(artifact: &Artifact, writer: &mut dyn Write) -> Result<(usize, usize)> {
        let payload = Payload {
            tree: artifact
                .document
                .as_ref()
                .map_or_else(Vec::new, |document| document_nodes::flatten(&document.tree)),
        };
        writer.write_all(&artifact.bytes).codec()?;
        let tree_len = {
            let mut counter = TreeWriter::new(writer);
            postcard::to_io(&payload, &mut counter).codec()?;
            counter.bytes
        };
        writer.flush().codec()?;
        Ok((tree_len, payload.tree.len()))
    }

    fn from_payload(
        artifact: &Artifact,
        metadata: Metadata,
        payload: Vec<u8>,
        tree_len: usize,
        record_count: usize,
    ) -> Self {
        Self {
            payload: payload.into_boxed_slice(),
            bytes_len: artifact.bytes.len(),
            tree_len,
            record_count,
            metadata,
            metadata_bytes: artifact
                .document
                .as_ref()
                .map_or(0, document_weight::metadata),
        }
    }

    /// Encoded document and tree payload length.
    pub fn bytes(&self) -> usize {
        self.payload.len()
    }

    /// Read retained usage without restoring document bytes or the tree.
    pub fn usage(&self) -> Option<&CatalogueUsage> {
        self.metadata
            .document
            .as_ref()
            .map(|metadata| &metadata.usage)
    }

    /// Conservative charge for payload, metadata, and container storage.
    pub fn retained_bytes(&self) -> usize {
        mem::size_of::<Self>()
            + self.payload.len()
            + self.metadata.content_type.capacity()
            + self.metadata_bytes
    }

    /// Restore exact bytes and annotations without parsing authored HTML.
    pub fn restore(&self) -> Result<Artifact> {
        let mut decoder = ZlibDecoder::new(self.payload.as_ref());
        let mut bytes = vec![0; self.bytes_len];
        decoder.read_exact(&mut bytes).codec()?;
        let records = {
            let mut tree = vec![0; self.tree_len];
            decoder.read_exact(&mut tree).codec()?;
            let (record_count, mut remaining) =
                postcard::take_from_bytes::<usize>(&tree).codec()?;
            if record_count != self.record_count {
                return Err(CodecInternalError::InvalidLength.into());
            }
            let mut records = Vec::with_capacity(self.record_count);
            for _ in 0..self.record_count {
                let (record, rest) = postcard::take_from_bytes::<FlatNode>(remaining).codec()?;
                records.push(record);
                remaining = rest;
            }
            if !remaining.is_empty() {
                return Err(CodecInternalError::InvalidLength.into());
            }
            records
        };
        if decoder.read(&mut [0]).codec()? != 0 || !decoder.get_ref().is_empty() {
            return Err(CodecInternalError::InvalidLength.into());
        }
        let tree = document_nodes::restore(records)?;
        Ok(Artifact {
            bytes,
            content_type: self.metadata.content_type.clone(),
            fragment: None,
            document: self.metadata.restore(tree),
        })
    }
}

#[cfg(test)]
#[path = "_tests_/document_codec_tests.rs"]
mod document_codec_tests;

#[cfg(test)]
#[path = "_tests_/document_damage_tests.rs"]
mod document_damage_tests;

#[cfg(test)]
#[path = "_tests_/document_optional_tests.rs"]
mod document_optional_tests;

#[cfg(test)]
#[path = "_tests_/document_identity_tests.rs"]
mod document_identity_tests;

#[cfg(test)]
#[path = "_tests_/document_persistence_tests.rs"]
mod document_persistence_tests;
