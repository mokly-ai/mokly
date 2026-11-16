//! A byte-bounded LRU render cache with no clock or filesystem dependency.

use std::collections::VecDeque;
use std::mem;
use std::sync::{Arc, Mutex};

use mokly_html::composition::Composed;
use mokly_html::fragment::Fragment;

use crate::cache_encoding::{DocumentEncoder, Encoder};
use crate::cache_state::State;
use crate::cache_transit::Transit;
use crate::document_codec::EncodedView;
use crate::key::NodeKey;
use crate::weight;

/// One rendered artifact. Cloned handles do not duplicate retained bytes.
#[derive(Clone, Debug)]
pub struct Artifact {
    /// Complete document, stylesheet, or fragment response bytes.
    pub bytes: Vec<u8>,
    /// Parsed tree and evidence for a document, absent for other resources.
    pub document: Option<Composed>,
    /// Memoized JavaScript output before markers are grafted into a document.
    pub fragment: Option<Fragment>,
    /// MIME type used by Serve and the static writer.
    pub content_type: String,
}

impl Artifact {
    /// Estimated retained-memory charge, including the tree and evidence.
    pub fn byte_cost(&self) -> usize {
        mem::size_of::<Self>()
            + self.bytes.capacity()
            + self.content_type.capacity()
            + self.document.as_ref().map_or(0, weight::document)
            + self.fragment.as_ref().map_or(0, weight::fragment)
    }
}

/// Cache statistics use operation counts, never wall-clock time.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct CacheStats {
    /// Cache-owned charge across tiers, transit reservations, and encoder leases.
    pub bytes: usize,
    /// Retained entries across both tiers and documents in transit.
    pub entries: usize,
    /// Lookups served by either tier or transit documents.
    pub hits: usize,
    /// Successful lookups restored from the compact tier.
    pub restores: usize,
    /// Compact lookups that failed to restore and must render again.
    pub restore_failures: usize,
    /// Lookups that the cache could not serve.
    pub misses: usize,
    /// Entries that left the cache.
    pub evictions: usize,
}

/// Stateful cache boundary shared by Serve, build, and comparison.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenderCacheMock))]
pub trait RenderCache: Send + Sync {
    /// Get a node. A compact document promotes only on reuse within full-tier turnover.
    fn get(&self, key: &NodeKey) -> Option<Arc<Artifact>>;
    /// Retain a result when it fits. Oversized results still return to the caller.
    fn insert(&self, key: NodeKey, value: Arc<Artifact>);
    /// Observe charged bytes and operation counts.
    fn stats(&self) -> CacheStats;
}

/// Bounded full artifacts and compact documents, each with its own LRU order.
pub struct MemoryCache {
    encoder: Arc<dyn Encoder>,
    state: Mutex<State>,
}

impl MemoryCache {
    /// Reserve one sixteenth of the total for transit; bound both tiers by the rest.
    pub fn new(total_bytes: usize, compact_ceiling: usize) -> Self {
        Self::with_encoder(
            total_bytes,
            compact_ceiling,
            Arc::new(DocumentEncoder::default()),
        )
    }

    fn with_encoder(total_bytes: usize, compact_ceiling: usize, encoder: Arc<dyn Encoder>) -> Self {
        let workspace = encoder.workspace_bytes();
        Self {
            encoder,
            state: Mutex::new(State::new(total_bytes, compact_ceiling, workspace)),
        }
    }

    /// Each new compact charge can displace more full entries. Encode outside locks.
    fn compact<'a>(&self, evicted: Vec<Transit<'a>>) {
        let mut pending = VecDeque::from(evicted);
        while let Some(reservation) = pending.pop_front() {
            let Some(value) = reservation.artifact() else {
                continue;
            };
            let Ok(encoded) = self.encoder.encode(value, reservation.lease()) else {
                continue;
            };
            let cost = compact_cost(reservation.key(), &encoded);
            pending.extend(reservation.complete(Arc::new(encoded), cost));
        }
    }

    fn promote(&self, key: &NodeKey, encoded: &Arc<EncodedView>, value: Arc<Artifact>) {
        let cost = entry_cost(key, &value);
        let evicted = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if !state.remove_compact(key, encoded) {
                return;
            }
            state.insert_full(&self.state, key.clone(), value, cost)
        };
        self.compact(evicted);
    }

    fn failed_restore(&self, key: &NodeKey, encoded: &Arc<EncodedView>) {
        tracing::error!("render cache document restore failed");
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.remove_compact(key, encoded) {
            state.stats.evictions = state.stats.evictions.saturating_add(1);
        }
        state.stats.restore_failures = state.stats.restore_failures.saturating_add(1);
        state.stats.misses = state.stats.misses.saturating_add(1);
    }
}

impl RenderCache for MemoryCache {
    fn get(&self, key: &NodeKey) -> Option<Arc<Artifact>> {
        let encoded = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.operation();
            if let Some(value) = state.full.get(key) {
                state.stats.hits = state.stats.hits.saturating_add(1);
                return Some(value);
            }
            if let Some(value) = state.transit.get(key) {
                state.stats.hits = state.stats.hits.saturating_add(1);
                return Some(value);
            }
            let Some(encoded) = state.compact.get(key) else {
                state.stats.misses = state.stats.misses.saturating_add(1);
                return None;
            };
            encoded
        };
        let artifact = match encoded.restore() {
            Ok(artifact) => Arc::new(artifact),
            Err(_) => {
                self.failed_restore(key, &encoded);
                return None;
            }
        };
        let promote = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.stats.hits = state.stats.hits.saturating_add(1);
            state.stats.restores = state.stats.restores.saturating_add(1);
            let operation = state.operations;
            let turnover = state.full.len();
            state.compact.restored(key, &encoded, operation, turnover)
        };
        if promote {
            self.promote(key, &encoded, artifact.clone());
        }
        Some(artifact)
    }

    fn insert(&self, key: NodeKey, value: Arc<Artifact>) {
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.operation();
            if state.compact.contains(&key) || state.transit.contains(&key) {
                return;
            }
        }
        let cost = entry_cost(&key, &value);
        let evicted = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if state.compact.contains(&key) || state.transit.contains(&key) {
                return;
            }
            state.insert_full(&self.state, key, value, cost)
        };
        self.compact(evicted);
    }

    fn stats(&self) -> CacheStats {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        CacheStats {
            bytes: state
                .full
                .bytes
                .saturating_add(state.compact.bytes)
                .saturating_add(state.transit.bytes)
                .saturating_add(state.encoders.bytes),
            entries: state
                .full
                .len()
                .saturating_add(state.compact.len())
                .saturating_add(state.transit.len()),
            ..state.stats
        }
    }
}

/// Charge the compact payload, both key records, and cache bookkeeping.
pub(crate) fn compact_cost(key: &NodeKey, value: &EncodedView) -> usize {
    value
        .retained_bytes()
        .saturating_add(key.0.capacity().saturating_mul(2))
        .saturating_add(256)
}

pub(crate) fn entry_cost(key: &NodeKey, value: &Artifact) -> usize {
    value
        .byte_cost()
        .saturating_add(key.0.capacity().saturating_mul(2))
        .saturating_add(256)
}

#[cfg(test)]
#[path = "_tests_/compact_cache_tests.rs"]
mod compact_cache_tests;

#[cfg(test)]
#[path = "_tests_/cache_promotion_tests.rs"]
mod cache_promotion_tests;

#[cfg(test)]
#[path = "_tests_/cache_transit_tests.rs"]
mod cache_transit_tests;

#[cfg(test)]
#[path = "_tests_/cache_encoding_tests.rs"]
mod cache_encoding_tests;
