//! Single-flight cache with lifetime-based byte accounting.

use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::atomic::AtomicU64;
use std::sync::{Arc, Mutex, MutexGuard};

#[cfg(test)]
use std::sync::atomic::Ordering;

use bytes::Bytes;
use lru::LruCache;
use mkc_domain::blob::BlobKey;
use thiserror::Error;

use crate::cache_fill::{
    ByteReservation, FillReservation, FillSignal, FillWaiter, accounted_bytes,
};
use crate::error::{Error as CatalogueError, Result};

/// Largest complete object eligible for hot-cache admission.
pub(crate) const MAX_CACHED_BLOB_BYTES: u64 = 8 * 1024 * 1024;
/// Fixed bookkeeping charge added to every entry's body length.
///
/// One entry owns a 64-byte LRU node, its 64-byte heap hash string, a 64-byte
/// shared entry header, up to 39 bytes of hash-table slot and 48 bytes of
/// allocator headers: 279 bytes, rounded up to the next power of two.
pub(crate) const ENTRY_OVERHEAD_BYTES: u64 = 512;
const TRACE_LOOKUP_INTERVAL: u64 = 1024;

#[derive(Debug, Error)]
pub(super) enum CacheError {
    #[error("[mkc-catalogue-server/cache] cache lock poisoned")]
    LockPoisoned,
    #[error("[mkc-catalogue-server/cache] completed fill has the wrong byte length")]
    LengthMismatch,
}

/// Result of a full-object cache lookup.
#[expect(unreachable_pub, reason = "unimock exposes method output types")]
pub enum CacheFill {
    /// Return verified bytes already held by the cache.
    Hit(Bytes),
    /// Await the one fill already running for this key.
    Wait(FillWaiter),
    /// Fill storage while holding the object's byte reservation.
    Reserved(FillReservation),
    /// Stream without buffering because no reservation is available.
    Bypass,
}

/// Verified-object cache behavior used by catalogue delivery.
#[unimock::unimock(api = BlobCacheMock)]
pub(crate) trait BlobCache: Send + Sync {
    /// Read and promote an existing entry without starting a fill.
    fn get(&self, key: &BlobKey) -> Result<Option<Bytes>>;
    /// Read, join or reserve one complete-object fill.
    fn begin_fill(&self, key: &BlobKey, length: u64) -> Result<CacheFill>;
}

/// Mutex-protected LRU with a process-wide lifetime byte budget.
pub(crate) struct LruBlobCache {
    core: Arc<Core>,
}

pub(super) struct Core {
    pub(super) state: Mutex<State>,
    pub(super) capacity: u64,
    pub(super) used: AtomicU64,
    pub(super) peak: AtomicU64,
}

pub(super) struct State {
    /// Unbounded by count: the byte budget and the entry overhead bound it to
    /// capacity ÷ 512 entries, so the table it keeps after evictions stays
    /// under 8% of the budget.
    pub(super) entries: LruCache<CacheKey, Arc<Entry>>,
    pub(super) fills: HashMap<CacheKey, Arc<FillSignal>>,
    counters: Counters,
}

pub(super) struct Entry {
    pub(super) bytes: Bytes,
    pub(super) _reservation: ByteReservation,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct CacheKey(pub(super) BlobKey);

impl Hash for CacheKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.0.hash.hash(state);
        self.0.incarnation.hash(state);
    }
}

#[derive(Clone, Copy, Default)]
struct Counters {
    hits: u64,
    misses: u64,
    evictions: u64,
    refused: u64,
}

impl LruBlobCache {
    /// Construct an enabled cache, returning no allocation or lock at zero.
    pub(crate) fn new(capacity: u64) -> Option<Self> {
        (capacity > 0).then(|| Self {
            core: Arc::new(Core {
                state: Mutex::new(State {
                    entries: LruCache::unbounded(),
                    fills: HashMap::new(),
                    counters: Counters::default(),
                }),
                capacity,
                used: AtomicU64::new(0),
                peak: AtomicU64::new(0),
            }),
        })
    }

    #[cfg(test)]
    pub(crate) fn accounted_bytes(&self) -> u64 {
        self.core.used.load(Ordering::SeqCst)
    }

    #[cfg(test)]
    pub(crate) fn peak_accounted_bytes(&self) -> u64 {
        self.core.peak.load(Ordering::SeqCst)
    }
}

impl BlobCache for LruBlobCache {
    fn get(&self, key: &BlobKey) -> Result<Option<Bytes>> {
        let (entry, counters) = {
            let mut state = self.core.state()?;
            let entry = state.entries.get(&CacheKey(key.clone())).cloned();
            record_lookup(&mut state.counters, entry.is_some());
            (entry, state.counters)
        };
        trace_lookup_counters(counters);
        Ok(entry.map(accounted_bytes))
    }

    fn begin_fill(&self, key: &BlobKey, length: u64) -> Result<CacheFill> {
        let key = CacheKey(key.clone());
        let counters = {
            let mut state = self.core.state()?;
            if let Some(entry) = state.entries.get(&key).cloned() {
                record_lookup(&mut state.counters, true);
                let counters = state.counters;
                trace_lookup_counters(counters);
                return Ok(CacheFill::Hit(accounted_bytes(entry)));
            }
            record_lookup(&mut state.counters, false);
            if let Some(signal) = state.fills.get(&key).cloned() {
                let counters = state.counters;
                trace_lookup_counters(counters);
                return Ok(CacheFill::Wait(FillWaiter::new(signal)));
            }
            state.counters
        };
        trace_lookup_counters(counters);
        self.reserve_or_evict(key, length)
    }
}

impl LruBlobCache {
    fn reserve_or_evict(&self, key: CacheKey, length: u64) -> Result<CacheFill> {
        let charged = length.saturating_add(ENTRY_OVERHEAD_BYTES);
        if length > MAX_CACHED_BLOB_BYTES || charged > self.core.capacity {
            self.refuse()?;
            return Ok(CacheFill::Bypass);
        }
        loop {
            let evicted = {
                let mut state = self.core.state()?;
                if let Some(entry) = state.entries.get(&key).cloned() {
                    return Ok(CacheFill::Hit(accounted_bytes(entry)));
                }
                if let Some(signal) = state.fills.get(&key).cloned() {
                    return Ok(CacheFill::Wait(FillWaiter::new(signal)));
                }
                if let Some(reservation) = self.core.reserve(charged) {
                    let signal = Arc::new(FillSignal::new());
                    state.fills.insert(key.clone(), signal.clone());
                    return Ok(CacheFill::Reserved(FillReservation::new(
                        self.core.clone(),
                        key,
                        signal,
                        reservation,
                        length,
                    )));
                }
                let evicted = state.entries.pop_lru().map(|(_, entry)| entry);
                if evicted.is_some() {
                    state.counters.evictions = state.counters.evictions.saturating_add(1);
                }
                (evicted, state.counters)
            };
            match evicted.0 {
                Some(_entry) => {
                    trace_counters(evicted.1);
                }
                None => {
                    self.refuse()?;
                    return Ok(CacheFill::Bypass);
                }
            }
        }
    }

    fn refuse(&self) -> Result<()> {
        let counters = {
            let mut state = self.core.state()?;
            state.counters.refused = state.counters.refused.saturating_add(1);
            state.counters
        };
        trace_counters(counters);
        Ok(())
    }
}

impl Core {
    pub(super) fn state(&self) -> Result<MutexGuard<'_, State>> {
        match self.state.lock() {
            Ok(state) => Ok(state),
            Err(_) => Err(CatalogueError::internal(CacheError::LockPoisoned)),
        }
    }
}

fn record_lookup(counters: &mut Counters, hit: bool) {
    if hit {
        counters.hits = counters.hits.saturating_add(1);
    } else {
        counters.misses = counters.misses.saturating_add(1);
    }
}

fn trace_counters(counters: Counters) {
    tracing::info!(
        hot_cache_hits = counters.hits,
        hot_cache_misses = counters.misses,
        hot_cache_evictions = counters.evictions,
        hot_cache_refused = counters.refused,
        "Catalogue hot-cache counters"
    );
}

/// Report after the first two lookups and then every 1,024; evictions and
/// refusals report at once through `trace_counters`.
fn trace_lookup_counters(counters: Counters) {
    let lookups = counters.hits.saturating_add(counters.misses);
    if lookups <= 2 || lookups.is_multiple_of(TRACE_LOOKUP_INTERVAL) {
        trace_counters(counters);
    }
}

#[cfg(test)]
#[path = "_tests_/cache_tests.rs"]
mod tests;
