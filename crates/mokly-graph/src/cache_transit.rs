//! A compaction reservation releases its document and charge on every exit path.

use std::sync::{Arc, Mutex};

use crate::cache::Artifact;
use crate::cache_state::State;
use crate::document_codec::EncodedView;
use crate::key::NodeKey;

/// Owns one reservation until an atomic transfer or automatic cleanup.
pub(crate) struct Transit<'a> {
    owner: &'a Mutex<State>,
    key: NodeKey,
    value: Option<Arc<Artifact>>,
}

impl<'a> Transit<'a> {
    /// State has already charged the readable transit entry before this handle leaves.
    pub(crate) fn new(owner: &'a Mutex<State>, key: NodeKey, value: Arc<Artifact>) -> Self {
        Self {
            owner,
            key,
            value: Some(value),
        }
    }

    /// Borrow the full document while its reservation is active.
    pub(crate) fn artifact(&self) -> Option<&Artifact> {
        self.value.as_deref()
    }

    /// Key whose stored charge includes cache bookkeeping.
    pub(crate) fn key(&self) -> &NodeKey {
        &self.key
    }

    /// Release the full artifact and transfer to the compact tier in one locked step.
    pub(crate) fn complete(mut self, encoded: Arc<EncodedView>, cost: usize) -> Vec<Self> {
        let mut state = self.owner.lock().unwrap_or_else(|error| error.into_inner());
        self.value = None;
        if state.transit.remove(&self.key).is_none() {
            return Vec::new();
        }
        state.insert_compact(self.owner, self.key.clone(), encoded, cost)
    }
}

impl Drop for Transit<'_> {
    fn drop(&mut self) {
        if self.value.is_none() {
            return;
        }
        let mut state = self.owner.lock().unwrap_or_else(|error| error.into_inner());
        self.value = None;
        if state.transit.remove(&self.key).is_some() {
            state.stats.evictions = state.stats.evictions.saturating_add(1);
        }
    }
}
