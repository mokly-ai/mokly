//! Lossless compressed comparison inputs; no parsed document survives capture.

use std::io::{BufReader, BufWriter, Read, Write};

use flate2::Compression;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use mokly_catalogue::diagnostic::Warning;
use mokly_graph::cache::Artifact;
use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use mokly_model::usage::CatalogueUsage;
use serde::{Deserialize, Serialize};

use crate::capture_error::{CaptureResult, Result};
use crate::capture_nodes::{self, FlatNode};

#[derive(Deserialize, Serialize)]
struct Payload {
    tree: Vec<FlatNode>,
    metadata: Option<Metadata>,
}

#[derive(Deserialize, Serialize)]
struct Metadata {
    usage: CatalogueUsage,
    resources: Vec<String>,
    components: Vec<String>,
    links: Vec<Reference>,
}

pub(crate) struct EncodedView {
    payload: Box<[u8]>,
    bytes_len: usize,
    warnings: Vec<Warning>,
    content_type: String,
}

impl EncodedView {
    pub(crate) fn encode(artifact: &Artifact) -> Result<Self> {
        let payload = Payload {
            tree: artifact
                .document
                .as_ref()
                .map_or_else(Vec::new, |document| capture_nodes::flatten(&document.tree)),
            metadata: artifact.document.as_ref().map(|document| Metadata {
                usage: document.usage.clone(),
                resources: document.resources.clone(),
                components: document.components.clone(),
                links: document.links.clone(),
            }),
        };
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
        })
    }

    pub(crate) fn bytes(&self) -> usize {
        self.payload.len()
    }

    pub(crate) fn restore(&self) -> Result<Artifact> {
        let mut decoder = BufReader::new(ZlibDecoder::new(self.payload.as_ref()));
        let mut bytes = vec![0; self.bytes_len];
        decoder.read_exact(&mut bytes).capture()?;
        let payload: Payload = serde_json::from_reader(decoder).capture()?;
        let tree = capture_nodes::restore(payload.tree)?;
        Ok(Artifact {
            bytes,
            content_type: self.content_type.clone(),
            fragment: None,
            document: payload.metadata.map(|metadata| Composed {
                tree,
                usage: metadata.usage,
                warnings: self.warnings.clone(),
                resources: metadata.resources,
                components: metadata.components,
                links: metadata.links,
            }),
        })
    }
}

#[cfg(test)]
#[path = "_tests_/capture_codec_tests.rs"]
mod capture_codec_tests;
