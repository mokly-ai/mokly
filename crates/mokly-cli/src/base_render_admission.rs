//! Host-specific evidence checks precede the first early base document render.

use std::sync::Arc;

use mokly_compare::base_render::{BasePreparationError, BasePreparationResult, PreparedBase};
use mokly_compare::error::{Error, Result};
use mokly_graph::types::RenderGeneration;

/// One preparation checks its host's prerequisites before it starts early renders.
pub(super) trait BaseRenderAdmission: Send + Sync {
    /// Validate the evidence required before any base document callback.
    fn check(&self) -> Result<()>;

    /// Start early document work and keep the scripts-off state beside any failure.
    fn admit(
        &self,
        generation: Arc<dyn RenderGeneration>,
        scripts_off: bool,
    ) -> BasePreparationResult {
        if let Err(source) = self.check() {
            return Err(BasePreparationError::new(scripts_off, source));
        }
        let prefetch = match generation.prefetch_comparison() {
            Ok(prefetch) => prefetch,
            Err(source) => {
                return Err(BasePreparationError::new(
                    scripts_off,
                    Error::Graph { source },
                ));
            }
        };
        Ok(PreparedBase {
            generation,
            prefetch,
            scripts_off,
            freshness: None,
        })
    }
}

/// Serve starts early renders as soon as preparation supplies the document keys.
pub(super) struct ImmediateBaseRenders;

impl BaseRenderAdmission for ImmediateBaseRenders {
    fn check(&self) -> Result<()> {
        Ok(())
    }
}
