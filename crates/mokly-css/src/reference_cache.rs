//! Content-addressed CSS reference scans with a retained-byte bound.

use std::collections::BTreeMap;
use std::fmt::Debug;
use std::mem;
use std::sync::{Arc, Mutex, MutexGuard};

use sha2::{Digest, Sha256};

use crate::syntax::{self, Reference};

/// The charge of one entry before its references: the digest in both maps, the entry, the
/// shared slice header, and the map node overhead.
const ENTRY_BYTES: usize = 256;

/// Deterministic cache operation counts.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct ReferenceCacheStats {
    /// Charged bytes retained by the cache.
    pub bytes: usize,
    /// Lookups that scanned their text.
    pub scans: usize,
    /// Lookups that reused a retained scan.
    pub hits: usize,
}

/// Stateful scan boundary. An equal text reuses a scan that the cache still holds.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ReferenceCacheMock))]
pub trait ReferenceCache: Debug + Send + Sync {
    /// The references of `source`, equal to `syntax::references(source)`.
    fn references(&self, source: &str) -> Arc<[Reference]>;
    /// Observe byte charges and operation counts.
    fn stats(&self) -> ReferenceCacheStats;
}

/// Process-memory LRU keyed by the SHA-256 digest of each text. A text that cannot hold a
/// reference returns an empty list without a lookup or a count. A scan runs outside the
/// lock, and a scan whose charge passes the bound returns without retention.
#[derive(Debug)]
pub struct MemoryReferenceCache {
    bound: usize,
    state: Mutex<State>,
}

#[derive(Debug, Default)]
struct State {
    entries: BTreeMap<[u8; 32], Entry>,
    order: BTreeMap<u64, [u8; 32]>,
    sequence: u64,
    stats: ReferenceCacheStats,
}

#[derive(Debug)]
struct Entry {
    sequence: u64,
    cost: usize,
    references: Arc<[Reference]>,
}

impl MemoryReferenceCache {
    /// Create an empty cache with an explicit byte bound.
    pub fn new(bound: usize) -> Self {
        Self {
            bound,
            state: Mutex::new(State::default()),
        }
    }

    fn state(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(|error| error.into_inner())
    }
}

impl ReferenceCache for MemoryReferenceCache {
    fn references(&self, source: &str) -> Arc<[Reference]> {
        if !syntax::may_have_references(source) {
            return Arc::default();
        }
        let key: [u8; 32] = Sha256::digest(source.as_bytes()).into();
        if let Some(references) = self.state().reuse(&key) {
            return references;
        }
        let references: Arc<[Reference]> = syntax::references(source).into();
        self.state().retain(key, references.clone(), self.bound);
        references
    }

    fn stats(&self) -> ReferenceCacheStats {
        self.state().stats
    }
}

impl State {
    /// Count a hit and make the entry the most recent one.
    fn reuse(&mut self, key: &[u8; 32]) -> Option<Arc<[Reference]>> {
        let entry = self.entries.get_mut(key)?;
        self.sequence += 1;
        self.order.remove(&entry.sequence);
        self.order.insert(self.sequence, *key);
        entry.sequence = self.sequence;
        self.stats.hits += 1;
        Some(entry.references.clone())
    }

    /// Count a scan and keep its result within the bound. An equal scan that another lookup
    /// retained first stays as it is.
    fn retain(&mut self, key: [u8; 32], references: Arc<[Reference]>, bound: usize) {
        self.stats.scans += 1;
        let cost = cost(&references);
        if cost > bound || self.entries.contains_key(&key) {
            return;
        }
        while self.stats.bytes > bound - cost {
            let Some((_, oldest)) = self.order.pop_first() else {
                break;
            };
            if let Some(entry) = self.entries.remove(&oldest) {
                self.stats.bytes -= entry.cost;
            }
        }
        self.sequence += 1;
        self.order.insert(self.sequence, key);
        self.entries.insert(
            key,
            Entry {
                sequence: self.sequence,
                cost,
                references,
            },
        );
        self.stats.bytes += cost;
    }
}

fn cost(references: &[Reference]) -> usize {
    ENTRY_BYTES
        + references
            .iter()
            .map(|reference| mem::size_of::<Reference>() + reference.value.capacity())
            .sum::<usize>()
}

#[cfg(test)]
#[path = "_tests_/reference_cache_tests.rs"]
mod reference_cache_tests;
