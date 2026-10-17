//! Keep generated CSS available without returning to a source-side PostCSS worker.

use std::collections::BTreeMap;
use std::io::{Read, Write};

use flate2::Compression;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use mokly_graph::types::RenderGeneration;
use mokly_model::material::digest;

use crate::capture_error::{self, CaptureResult, Result};

pub(crate) struct EncodedStyle {
    pub(crate) digest: String,
    bytes: Vec<u8>,
}

impl EncodedStyle {
    fn encode(bytes: &[u8]) -> Result<Self> {
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
        encoder.write_all(bytes).capture()?;
        Ok(Self {
            digest: digest(bytes),
            bytes: encoder.finish().capture()?,
        })
    }
    pub(crate) fn read(&self) -> Result<Vec<u8>> {
        let mut bytes = Vec::new();
        ZlibDecoder::new(self.bytes.as_slice())
            .read_to_end(&mut bytes)
            .capture()?;
        Ok(bytes)
    }
}

pub(crate) fn capture(
    source: &dyn RenderGeneration,
) -> mokly_graph::error::Result<BTreeMap<String, EncodedStyle>> {
    let mut styles = BTreeMap::new();
    for route in source
        .resource_routes()
        .into_iter()
        .filter(|route| route.starts_with("styles/"))
    {
        if let Some(bytes) = source.resource(&route)? {
            styles.insert(route, capture_error::graph(EncodedStyle::encode(&bytes))?);
        }
    }
    Ok(styles)
}
