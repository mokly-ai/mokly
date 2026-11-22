//! Weak Serve head contexts constrain speculative preparation without extending ownership.

use std::sync::{Arc, Weak};

use crate::leases::ContextLease;
use crate::runtime::Runtime;

impl Runtime {
    /// Stylesheet watching identifies Serve head startup and edits, independently of capture mode.
    pub(crate) fn serve_head(&self) -> bool {
        self.watch_stylesheets && self.base.is_none() && self.head_styles.is_none()
    }

    /// Register a head context without retaining its graph or child.
    pub(crate) fn track_head_context(&self, context: &Arc<ContextLease>) {
        if !self.serve_head() {
            return;
        }
        let mut contexts = self
            .contexts
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        contexts.retain(|entry| entry.strong_count() != 0);
        contexts.push(Arc::downgrade(context));
    }

    /// A different used head context still needs this effective configuration.
    pub(crate) fn older_used_head_context(&self, context: &ContextLease) -> bool {
        let mut contexts = self
            .contexts
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        contexts.retain(|entry| entry.strong_count() != 0);
        contexts.iter().filter_map(Weak::upgrade).any(|older| {
            older.id != context.id
                && older.configuration == context.configuration
                && older.used_live()
        })
    }
}

#[cfg(test)]
#[path = "_tests_/context_retention_tests.rs"]
mod context_retention_tests;
