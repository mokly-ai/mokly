//! A byte-bounded LRU render cache with no clock or filesystem dependency.

use std::collections::BTreeMap;
use std::mem;
use std::sync::{Arc, Mutex};

use mokly_html::composition::Composed;
use mokly_html::fragment::Fragment;

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
    /// Conservative retained-memory charge, including the tree and evidence.
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
    /// Cache-owned memory charge.
    pub bytes: usize,
    /// Retained artifacts.
    pub entries: usize,
    /// Successful lookups.
    pub hits: usize,
    /// Absent lookups.
    pub misses: usize,
    /// Evicted artifacts.
    pub evictions: usize,
}

/// Stateful cache boundary shared by Serve, build, and comparison.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenderCacheMock))]
pub trait RenderCache: Send + Sync {
    /// Get a node and promote it to most recently used.
    fn get(&self, key: &NodeKey) -> Option<Arc<Artifact>>;
    /// Retain a result when it fits. Oversized results still return to the caller.
    fn insert(&self, key: NodeKey, value: Arc<Artifact>);
    /// Observe retained bytes and operation counts.
    fn stats(&self) -> CacheStats;
}

/// Process-memory LRU; eviction changes rendering work only.
pub struct MemoryCache {
    bound: usize,
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    values: BTreeMap<NodeKey, (u128, Arc<Artifact>)>,
    order: BTreeMap<u128, NodeKey>,
    next: u128,
    stats: CacheStats,
}

impl MemoryCache {
    /// Construct an empty cache with the supplied retained-byte bound.
    pub fn new(bytes: usize) -> Self {
        Self {
            bound: bytes,
            state: Mutex::new(State::default()),
        }
    }
}

impl RenderCache for MemoryCache {
    fn get(&self, key: &NodeKey) -> Option<Arc<Artifact>> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some((stored, (old, artifact))) = state.values.remove_entry(key) else {
            state.stats.misses += 1;
            return None;
        };
        state.order.remove(&old);
        state.next += 1;
        let next = state.next;
        state.order.insert(next, stored.clone());
        state.values.insert(stored, (next, artifact.clone()));
        state.stats.hits += 1;
        Some(artifact)
    }

    fn insert(&self, key: NodeKey, value: Arc<Artifact>) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if let Some((stored, (old, value))) = state.values.remove_entry(&key) {
            state.order.remove(&old);
            state.stats.bytes -= entry_cost(&stored, &value);
        }
        let cost = entry_cost(&key, &value);
        if cost > self.bound {
            state.stats.entries = state.values.len();
            return;
        }
        while state.stats.bytes > self.bound - cost {
            let Some((_, key)) = state.order.pop_first() else {
                break;
            };
            if let Some((stored, (_, value))) = state.values.remove_entry(&key) {
                state.stats.bytes -= entry_cost(&stored, &value);
                state.stats.evictions += 1;
            }
        }
        state.next += 1;
        let next = state.next;
        state.order.insert(next, key.clone());
        state.values.insert(key, (next, value));
        state.stats.bytes += cost;
        state.stats.entries = state.values.len();
    }

    fn stats(&self) -> CacheStats {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .stats
    }
}

pub(crate) fn entry_cost(key: &NodeKey, value: &Artifact) -> usize {
    value
        .byte_cost()
        .saturating_add(key.0.capacity().saturating_mul(2))
        .saturating_add(256)
}
