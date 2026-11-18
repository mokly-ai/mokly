//! Failed restores keep source reads and diagnostics in ordered consumption.

use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_input::ComparisonFallback;
use mokly_graph::document_error::CodecError;
use mokly_graph::error::Result;
use mokly_graph::types::RenderGeneration;

pub(crate) struct RestoreFallback {
    pub(crate) source: Arc<dyn RenderGeneration>,
    pub(crate) captured: Closure,
    pub(crate) error: CodecError,
}

impl ComparisonFallback for RestoreFallback {
    fn document(&self, route: &str) -> Result<Arc<Artifact>> {
        let _restore_error = &self.error;
        tracing::error!("comparison capture document restore failed; reading source");
        self.source.comparison_document(route)
    }

    fn closure(&self) -> Closure {
        self.captured.clone()
    }
}
