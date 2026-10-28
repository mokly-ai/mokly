//! Retain generated CSS and every generated asset digest without source-root revisits.

use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::mem;

use flate2::Compression;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use mokly_graph::types::RenderGeneration;
use mokly_model::{material, namespace};

use crate::capture_error::{self, CaptureDecode, CaptureResult, Result};
use crate::capture_weight::Budget;

/// Generated-route digest and optional compressed CSS bytes.
pub(crate) struct EncodedResource {
    /// Exact source digest, including a validated missing-resource result.
    pub(crate) digest: Option<String>,
    content: Content,
}

enum Content {
    Asset,
    Style(Option<Box<[u8]>>),
}

impl EncodedResource {
    fn style(bytes: Option<Vec<u8>>) -> Result<Self> {
        let Some(bytes) = bytes else {
            return Ok(Self {
                digest: None,
                content: Content::Style(None),
            });
        };
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
        encoder.write_all(&bytes).capture()?;
        Ok(Self {
            digest: Some(material::digest(&bytes)),
            content: Content::Style(Some(encoder.finish().capture()?.into_boxed_slice())),
        })
    }
    /// Whether reads can replay CSS, including a missing stylesheet.
    pub(crate) fn retains_bytes(&self) -> bool {
        matches!(self.content, Content::Style(_))
    }
    /// Compressed CSS payload length; opaque assets retain only their digests.
    pub(crate) fn encoded_bytes(&self) -> usize {
        match &self.content {
            Content::Style(Some(bytes)) => bytes.len(),
            _ => 0,
        }
    }
    fn retained_bytes(&self) -> usize {
        mem::size_of::<Self>()
            + self.digest.as_ref().map_or(0, String::capacity)
            + self.encoded_bytes()
    }
    /// Restore captured CSS bytes without a source-side compiler.
    pub(crate) fn read(&self) -> Result<Option<Vec<u8>>> {
        let Content::Style(Some(encoded)) = &self.content else {
            return Ok(None);
        };
        let mut bytes = Vec::new();
        ZlibDecoder::new(encoded.as_ref())
            .read_to_end(&mut bytes)
            .decode()?;
        Ok(Some(bytes))
    }
}

/// Capture generated facts for one side within its byte budget.
pub(crate) fn capture(
    source: &dyn RenderGeneration,
    budget: &mut Budget,
    reclaim: &mut dyn FnMut(usize),
) -> mokly_graph::error::Result<BTreeMap<String, EncodedResource>> {
    let mut resources = BTreeMap::new();
    for route in source.resource_routes() {
        let resource =
            if route.starts_with("styles/") || route.to_ascii_lowercase().ends_with(".css") {
                capture_error::graph(EncodedResource::style(source.resource(&route)?))?
            } else {
                EncodedResource {
                    digest: source.resource_digest(&namespace::generated(&route))?,
                    content: Content::Asset,
                }
            };
        if budget.retain(256 + route.capacity() + resource.retained_bytes()) {
            reclaim(budget.remaining());
            resources.insert(route, resource);
        }
    }
    Ok(resources)
}
