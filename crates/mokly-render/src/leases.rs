//! Graph-owned sidecar lifetimes release state after the final request finishes.

use std::fmt;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;

use mokly_catalogue::render_sources::GenerationLease;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::postcss_preparation::PostcssPreparation;

use crate::bundle::BundleState;
use crate::side::SideInputs;
use crate::stylesheet_compiler::StylesheetPreparation;

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
    /// Effective stylesheet settings identify configuration independently of context ids.
    pub(crate) configuration: String,
    pub(crate) pool: Arc<dyn SidecarPool>,
    pub(crate) released: Sender<String>,
    pub(crate) used: AtomicBool,
    /// The attempt has reserved its one preparation.
    pub(crate) prepared: AtomicBool,
    active: AtomicBool,
}

impl ContextLease {
    /// Create one inactive context with explicit effective configuration identity.
    pub(crate) fn new(
        id: String,
        configuration: String,
        pool: Arc<dyn SidecarPool>,
        released: Sender<String>,
    ) -> Self {
        Self {
            id,
            configuration,
            pool,
            released,
            used: AtomicBool::new(false),
            prepared: AtomicBool::new(false),
            active: AtomicBool::new(false),
        }
    }

    /// A real stylesheet request starts or resumes this context's child lifetime.
    pub(crate) fn begin_use(&self) {
        self.active.store(true, Ordering::Relaxed);
        self.used.store(true, Ordering::Relaxed);
    }

    /// End a context that no later compilation can reach.
    pub(crate) fn retire(&self) {
        self.release();
    }

    /// A used child that has not ended still needs this lease's consumer state.
    pub(crate) fn used_live(&self) -> bool {
        self.used.load(Ordering::Relaxed) && self.active.load(Ordering::Relaxed)
    }

    /// Reserve the attempt's only preparation before its first real stylesheet request.
    pub(crate) fn prepare(&self, postcss: String) -> Option<PostcssPreparation> {
        if self.used.load(Ordering::Relaxed) || self.prepared.swap(true, Ordering::Relaxed) {
            return None;
        }
        self.active.store(true, Ordering::Relaxed);
        Some(PostcssPreparation {
            context: self.id.clone(),
            postcss,
        })
    }

    /// Unused preparation ends with its attempt, while later lazy CSS can start again.
    pub(crate) fn finish_preparation(&self) {
        if self.prepared.swap(false, Ordering::Relaxed) && !self.used.load(Ordering::Relaxed) {
            self.release();
        }
    }

    fn release(&self) {
        if self.active.swap(false, Ordering::Relaxed) {
            let _ = self.released.send(self.id.clone());
            self.pool.release_context(&self.id);
        }
    }
}

impl Drop for ContextLease {
    fn drop(&mut self) {
        self.release();
    }
}

pub(crate) struct PreparedLease {
    pub(crate) bundle: Arc<BundleState>,
    pub(crate) side: SideInputs,
    pub(crate) compiler: Arc<dyn StylesheetPreparation>,
    /// Context ownership through description and complete graph preparation.
    pub(crate) context: Option<Arc<ContextLease>>,
}

/// Keep an unused preparation alive through every configured and imported graph stylesheet.
pub(crate) struct FinishPreparation(pub(crate) Option<Arc<ContextLease>>);

impl Drop for FinishPreparation {
    fn drop(&mut self) {
        if let Some(context) = &self.0 {
            context.finish_preparation();
        }
    }
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

#[cfg(test)]
#[path = "_tests_/context_retirement_tests.rs"]
mod context_retirement_tests;
