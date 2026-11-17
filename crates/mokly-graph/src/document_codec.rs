//! Lossless compressed documents shared by render-cache eviction and comparison capture.

use std::io::{BufReader, BufWriter, Read, Write};
use std::mem;

use flate2::Compression;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use mokly_catalogue::diagnostic::Warning;
use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use mokly_model::usage::CatalogueUsage;
use serde::{Deserialize, Serialize};

use crate::cache::Artifact;
use crate::document_error::{CodecResult, Result};
use crate::document_nodes::{self, FlatNode};
use crate::document_weight;

#[derive(Deserialize, Serialize)]
struct Payload {
    tree: Vec<FlatNode>,
}

struct Metadata {
    usage: CatalogueUsage,
    resources: Vec<String>,
    components: Vec<String>,
    links: Vec<Reference>,
}

/// Immutable compressed tree/bytes with Rust metadata outside the codec.
pub struct EncodedView {
    payload: Box<[u8]>,
    bytes_len: usize,
    warnings: Vec<Warning>,
    content_type: String,
    metadata: Option<Metadata>,
    metadata_bytes: usize,
}

impl EncodedView {
    /// Encode one validated document and retain its complete metadata.
    pub fn encode(artifact: &Artifact) -> Result<Self> {
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
        {
            let mut writer = BufWriter::new(&mut encoder);
            Self::write_payload(artifact, &mut writer)?;
        }
        Ok(Self::from_payload(artifact, encoder.finish().codec()?))
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
        result?;
        Ok(Self::from_payload(artifact, payload))
    }

    fn write_payload(artifact: &Artifact, writer: &mut dyn Write) -> Result<()> {
        let payload = Payload {
            tree: artifact
                .document
                .as_ref()
                .map_or_else(Vec::new, |document| document_nodes::flatten(&document.tree)),
        };
        writer.write_all(&artifact.bytes).codec()?;
        serde_json::to_writer(&mut *writer, &payload).codec()?;
        writer.flush().codec()
    }

    fn from_payload(artifact: &Artifact, payload: Vec<u8>) -> Self {
        let metadata = artifact.document.as_ref().map(|document| Metadata {
            usage: document.usage.clone(),
            resources: document.resources.clone(),
            components: document.components.clone(),
            links: document.links.clone(),
        });
        Self {
            payload: payload.into_boxed_slice(),
            bytes_len: artifact.bytes.len(),
            warnings: artifact
                .document
                .as_ref()
                .map_or_else(Vec::new, |document| document.warnings.clone()),
            content_type: artifact.content_type.clone(),
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
        self.metadata.as_ref().map(|metadata| &metadata.usage)
    }

    /// Conservative charge for payload, metadata, and container storage.
    pub fn retained_bytes(&self) -> usize {
        mem::size_of::<Self>()
            + self.payload.len()
            + self.content_type.capacity()
            + self.metadata_bytes
    }

    /// Restore exact bytes and annotations without parsing authored HTML.
    pub fn restore(&self) -> Result<Artifact> {
        let mut decoder = BufReader::new(ZlibDecoder::new(self.payload.as_ref()));
        let mut bytes = vec![0; self.bytes_len];
        decoder.read_exact(&mut bytes).codec()?;
        let payload: Payload = serde_json::from_reader(decoder).codec()?;
        let tree = document_nodes::restore(payload.tree)?;
        Ok(Artifact {
            bytes,
            content_type: self.content_type.clone(),
            fragment: None,
            document: self.metadata.as_ref().map(|metadata| Composed {
                tree,
                usage: metadata.usage.clone(),
                warnings: self.warnings.clone(),
                resources: metadata.resources.clone(),
                components: metadata.components.clone(),
                links: metadata.links.clone(),
            }),
        })
    }
}

#[cfg(test)]
#[path = "_tests_/document_codec_tests.rs"]
mod document_codec_tests;
