//! Injectable document encoding outside the cache lock.

use crate::cache::Artifact;
use crate::document_codec::EncodedView;
use crate::document_error::Result;

/// Compaction boundary for evicted documents.
#[cfg_attr(test, unimock::unimock(api = EncoderMock))]
pub(crate) trait Encoder: Send + Sync {
    /// Encode one artifact without retaining its full representation.
    fn encode(&self, artifact: &Artifact) -> Result<EncodedView>;
}

/// The cache and comparison capture use the same lossless codec.
pub(crate) struct DocumentEncoder;

impl Encoder for DocumentEncoder {
    fn encode(&self, artifact: &Artifact) -> Result<EncodedView> {
        EncodedView::encode(artifact)
    }
}
