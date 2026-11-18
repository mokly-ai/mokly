//! Reuse a complete source extraction before historical configuration reads.

use std::sync::Arc;

use mokly_compare::base_render::BaseRequest;
use mokly_compare::cache_types::Lease;
use mokly_compare::error::{Error, Result};

use crate::changes_base::NativeBase;

impl NativeBase {
    /// Before the base configuration loads, leases an existing complete extraction
    /// and attaches it to the base sources, when the working configuration names a
    /// renderer or PostCSS. This optional step never builds an extraction, and a
    /// failure other than cancellation leaves the base reads on Git.
    pub(super) fn early_sources(&self, request: &BaseRequest<'_>) -> Result<Option<Arc<Lease>>> {
        let input = &request.working_config.input;
        if input.renderer.is_none() && input.postcss.is_none() {
            return Ok(None);
        }
        let attached = self
            .dependencies
            .existing_sources(request)
            .and_then(|lease| match lease {
                Some(lease) => {
                    request.sources.sources.attach(lease.clone())?;
                    Ok(Some(lease))
                }
                None => Ok(None),
            });
        match attached {
            Err(Error::Cancelled) => Err(Error::Cancelled),
            Err(error) => {
                tracing::debug!(%error, "base reads stay on Git before the dependency step");
                Ok(None)
            }
            result => result,
        }
    }
}
