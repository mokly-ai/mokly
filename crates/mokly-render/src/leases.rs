//! Graph-owned sidecar lifetimes release state after the final request finishes.

use std::fmt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::render_sources::GenerationLease;
use mokly_css::types::StylesheetBundler;
use mokly_sidecar::bindings::DisposeContext;
use mokly_sidecar::methods::{Call, Generation};
use mokly_sidecar::pool::SidecarPool;

use crate::bundle::BundleState;
use crate::postcss_cache::CssCache;
use crate::side::SideInputs;

pub(crate) struct BundleLease {
    pub(crate) id: String,
    pub(crate) pool: Arc<dyn SidecarPool>,
}

impl Drop for BundleLease {
    fn drop(&mut self) {
        if let Err(error) = self.pool.request(Call::Dispose(Generation {
            generation: self.id.clone(),
        })) {
            tracing::debug!(%error, "bundle release finished after cancellation");
        }
    }
}

pub(crate) struct ContextLease {
    pub(crate) id: String,
    pub(crate) pool: Arc<dyn SidecarPool>,
    pub(crate) cache: Arc<Mutex<CssCache>>,
    pub(crate) used: AtomicBool,
}

impl Drop for ContextLease {
    fn drop(&mut self) {
        {
            let mut cache = self.cache.lock().unwrap_or_else(|error| error.into_inner());
            cache.scans.remove(&self.id);
            let prefix = format!("{}:", self.id);
            cache.records.retain(|key, _| !key.starts_with(&prefix));
        }
        if self.used.load(Ordering::Relaxed)
            && let Err(error) = self.pool.request(Call::DisposeContext(DisposeContext {
                context: self.id.clone(),
            }))
        {
            tracing::debug!(%error, "PostCSS release finished after cancellation");
        }
    }
}

pub(crate) struct PreparedLease {
    pub(crate) bundle: Arc<BundleState>,
    pub(crate) side: SideInputs,
    pub(crate) compiler: Arc<dyn StylesheetBundler>,
}

impl fmt::Debug for PreparedLease {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("PreparedLease")
            .field("generation", &self.bundle.lease.id)
            .finish_non_exhaustive()
    }
}

impl GenerationLease for PreparedLease {}
