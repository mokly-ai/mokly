//! Fallible restoration boundary for immutable captured documents.

use mokly_graph::cache::Artifact;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_error::Result;

/// Restore the retained document, or let the capture return to its source.
#[cfg_attr(test, unimock::unimock(api = DocumentRestorerMock))]
pub(crate) trait DocumentRestorer: Send + Sync {
    /// Decode one trusted in-process view.
    fn restore(&self, view: &EncodedView) -> Result<Artifact>;
}

/// The shared lossless codec used by real captures.
pub(crate) struct LosslessRestorer;

impl DocumentRestorer for LosslessRestorer {
    fn restore(&self, view: &EncodedView) -> Result<Artifact> {
        view.restore()
    }
}
