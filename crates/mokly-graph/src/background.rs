//! Per-view ownership of background completion and admitted fragment bytes.

use std::fmt;
use std::sync::Arc;

use mokly_html::composition::CompositionAdmission;
use mokly_html::fragment::Fragment;

use crate::cache::RenderCache;
use crate::cache_lease::ByteLease;
use crate::fragment_weight;

/// A background view's completion place and optional early dispatch release.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CompletionMock))]
pub trait Completion: Send + Sync {
    /// Enter completion while retaining the original document dispatch place.
    fn enter(&self);
    /// Enter completion and release dispatch after a successful charged root.
    fn handoff(&self, lease: Box<dyn ByteLease>);
    /// Retained scheduler and queue metadata that the root lease must include.
    fn metadata_bytes(&self) -> usize;
}

impl fmt::Debug for dyn Completion + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Completion")
    }
}

pub(crate) struct RootAdmission {
    pub(crate) cache: Arc<dyn RenderCache>,
    pub(crate) completion: Arc<dyn Completion>,
}

impl CompositionAdmission for RootAdmission {
    fn enter(&self) {
        self.completion.enter();
    }
    fn root_fragment(&self, fragment: &Fragment, context_bytes: usize) {
        let bytes = fragment_weight::retained(fragment)
            .saturating_add(context_bytes)
            .saturating_add(self.completion.metadata_bytes());
        if let Some(lease) = self.cache.reserve(bytes) {
            self.completion.handoff(lease);
        } else {
            self.completion.enter();
        }
    }
}

#[cfg(test)]
#[path = "_tests_/background_defaults_tests.rs"]
mod background_defaults_tests;
