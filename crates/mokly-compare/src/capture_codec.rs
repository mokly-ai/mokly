//! Lossless compressed comparison inputs; no parsed document survives capture.

use std::io::{BufReader, BufWriter, Read, Write};
use std::mem;

use flate2::Compression;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use mokly_catalogue::diagnostic::Warning;
use mokly_graph::cache::Artifact;
use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use mokly_model::usage::CatalogueUsage;
use serde::{Deserialize, Serialize};

use crate::capture_error::{CaptureDecode, CaptureResult, Result};
use crate::capture_nodes::{self, FlatNode};
use crate::capture_weight;

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
pub(crate) struct EncodedView {
    payload: Box<[u8]>,
    bytes_len: usize,
    warnings: Vec<Warning>,
    content_type: String,
    metadata: Option<Metadata>,
    metadata_bytes: usize,
}

impl EncodedView {
    /// Encode one validated document and retain its complete metadata.
    pub(crate) fn encode(artifact: &Artifact) -> Result<Self> {
        let payload = Payload {
            tree: artifact
                .document
                .as_ref()
                .map_or_else(Vec::new, |document| capture_nodes::flatten(&document.tree)),
        };
        let metadata = artifact.document.as_ref().map(|document| Metadata {
            usage: document.usage.clone(),
            resources: document.resources.clone(),
            components: document.components.clone(),
            links: document.links.clone(),
        });
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
        {
            let mut writer = BufWriter::new(&mut encoder);
            writer.write_all(&artifact.bytes).capture()?;
            serde_json::to_writer(&mut writer, &payload).capture()?;
            writer.flush().capture()?;
        }
        Ok(Self {
            payload: encoder.finish().capture()?.into_boxed_slice(),
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
                .map_or(0, capture_weight::metadata),
        })
    }

    /// Encoded document and tree payload length.
    pub(crate) fn bytes(&self) -> usize {
        self.payload.len()
    }

    /// Conservative charge for payload, metadata, and container storage.
    pub(crate) fn retained_bytes(&self) -> usize {
        mem::size_of::<Self>()
            + self.payload.len()
            + self.content_type.capacity()
            + self.metadata_bytes
    }

    /// Restore exact bytes and annotations without parsing authored HTML.
    pub(crate) fn restore(&self) -> Result<Artifact> {
        let mut decoder = BufReader::new(ZlibDecoder::new(self.payload.as_ref()));
        let mut bytes = vec![0; self.bytes_len];
        decoder.read_exact(&mut bytes).decode()?;
        let payload: Payload = serde_json::from_reader(decoder).decode()?;
        let tree = capture_nodes::restore(payload.tree)?;
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
#[path = "_tests_/capture_codec_tests.rs"]
mod capture_codec_tests;
