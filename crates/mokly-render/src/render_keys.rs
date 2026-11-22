//! Only Serve-head edits reuse keys from a live generation shared across attempt copies.

use std::sync::Arc;

use mokly_graph::key::NodeKey;
use mokly_graph::render_inputs::{RenderInputs, RenderKeys};
use mokly_sidecar::methods::BundleCapture;

use crate::runtime::Runtime;

impl Runtime {
    /// Defer startup facts and consume completed predecessors only for Serve edits.
    pub(crate) fn render_keys(
        &self,
        inputs: &RenderInputs<'_>,
        fallback: NodeKey,
    ) -> Arc<RenderKeys> {
        let Some(latest) = &self.render_keys else {
            return Arc::new(RenderKeys::build_with_workers(
                inputs,
                fallback,
                self.workers.as_ref(),
            ));
        };
        if self.bundle_capture == BundleCapture::Full {
            let keys = Arc::new(RenderKeys::build_unseeded_with_workers(
                inputs,
                fallback,
                self.workers.as_ref(),
            ));
            *latest.lock().unwrap_or_else(|error| error.into_inner()) = Arc::downgrade(&keys);
            return keys;
        }
        let previous = if self.bundle_capture == BundleCapture::ServeEdit {
            latest
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .upgrade()
        } else {
            None
        };
        let keys = Arc::new(RenderKeys::build_reusing_with_workers(
            inputs,
            fallback,
            self.workers.as_ref(),
            previous.as_deref(),
        ));
        *latest.lock().unwrap_or_else(|error| error.into_inner()) = Arc::downgrade(&keys);
        keys
    }
}
