//! Graph-owned sidecar lifetimes release state after the final request finishes.

use std::fmt;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;

use mokly_catalogue::render_sources::GenerationLease;
use mokly_css::types::StylesheetBundler;
use mokly_sidecar::pool::SidecarPool;

use crate::bundle::BundleState;
use crate::side::SideInputs;

pub(crate) struct BundleLease {
    pub(crate) id: String,
    pub(crate) epoch: u64,
    pub(crate) pool: Arc<dyn SidecarPool>,
}

impl Drop for BundleLease {
    fn drop(&mut self) {
        self.pool.release_generation(&self.id, self.epoch);
    }
}

pub(crate) struct ContextLease {
    pub(crate) id: String,
    pub(crate) pool: Arc<dyn SidecarPool>,
    pub(crate) released: Sender<String>,
    pub(crate) used: AtomicBool,
}

impl Drop for ContextLease {
    fn drop(&mut self) {
        if self.used.load(Ordering::Relaxed) {
            let _ = self.released.send(self.id.clone());
            self.pool.release_context(&self.id);
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

#[cfg(test)]
#[path = "_tests_/lease_drop_tests.rs"]
mod lease_drop_tests;
