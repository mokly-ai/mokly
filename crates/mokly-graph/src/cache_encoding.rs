//! Injectable document encoding outside the cache lock.

use std::io::BufWriter;
use std::sync::Mutex;

use flate2::Compression;
use flate2::write::ZlibEncoder;

use crate::cache::Artifact;
use crate::cache_encoder_pool::ENCODER_LEASES;
use crate::document_codec::EncodedView;
use crate::document_error::Result;
use crate::export_memory::ExportObserver;

/// Compaction boundary for evicted documents.
#[cfg_attr(test, unimock::unimock(api = EncoderMock))]
pub(crate) trait Encoder: Send + Sync {
    /// Fixed workspace retained by each reusable encoding lease.
    fn workspace_bytes(&self) -> usize;

    /// Encode one artifact without retaining its full representation.
    fn encode(&self, artifact: &Artifact, lease: usize) -> Result<EncodedView>;
    /// Export observes scratch while compaction keeps its existing entry point.
    fn encode_export(
        &self,
        artifact: &Artifact,
        lease: usize,
        _observer: Option<&dyn ExportObserver>,
    ) -> Result<EncodedView> {
        self.encode(artifact, lease)
    }
}

/// The cache and comparison capture use the same lossless codec.
pub(crate) struct DocumentEncoder {
    leases: [Mutex<Option<Workspace>>; ENCODER_LEASES],
}

struct Workspace {
    writer: BufWriter<ZlibEncoder<Vec<u8>>>,
}

impl Default for DocumentEncoder {
    fn default() -> Self {
        Self {
            leases: std::array::from_fn(|_| Mutex::new(None)),
        }
    }
}

impl Encoder for DocumentEncoder {
    fn workspace_bytes(&self) -> usize {
        384 * 1024
    }

    fn encode(&self, artifact: &Artifact, lease: usize) -> Result<EncodedView> {
        self.encode_export(artifact, lease, None)
    }

    fn encode_export(
        &self,
        artifact: &Artifact,
        lease: usize,
        observer: Option<&dyn ExportObserver>,
    ) -> Result<EncodedView> {
        let mut workspace = self.leases[lease]
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let result = {
            let workspace = workspace.get_or_insert_with(|| Workspace {
                writer: BufWriter::new(ZlibEncoder::new(Vec::new(), Compression::fast())),
            });
            if observer.is_some() {
                EncodedView::encode_export(artifact, &mut workspace.writer, observer)
            } else {
                EncodedView::encode_pooled(artifact, &mut workspace.writer)
            }
        };
        if result.is_err() {
            *workspace = None;
        }
        result
    }
}
