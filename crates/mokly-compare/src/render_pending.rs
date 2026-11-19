//! Bounded pending keys and ordered writer-state diagnostics.

use std::collections::{BTreeSet, VecDeque};
use std::mem;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Condvar, Mutex};

use mokly_graph::document_store::{EntryFault, StoreKey, StoreStats};
use mokly_graph::key::NodeKey;

/// Optional cache warnings keep terminal output separate from the storage implementation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StoreWarning {
    /// One damaged, unreadable, or foreign entry.
    Entry(EntryFault),
    /// The first directory or worker fault.
    Directory,
}

/// Command-owned diagnostics for state changes and recoverable cache warnings.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StoreObserverMock))]
pub trait StoreObserver: Send + Sync {
    /// Observe every admission, completion, and cancellation state.
    fn state(&self, stats: StoreStats);
    /// Report one cache warning with the bundle cache's cadence.
    fn warning(&self, warning: StoreWarning);
}

/// Structured diagnostics consumed by measurements without changing render-cache counts.
pub struct TraceStoreObserver;
impl StoreObserver for TraceStoreObserver {
    fn state(&self, stats: StoreStats) {
        tracing::debug!(target: "mokly::render_store", event = "state", sequence = stats.sequence, queued = stats.queued, active = stats.active,
            hits = stats.hits, misses = stats.misses, faults = stats.faults, writes = stats.writes, bytes = stats.bytes, drops = stats.drops);
    }
    fn warning(&self, warning: StoreWarning) {
        tracing::debug!(target: "mokly::render_store", ?warning, "optional document store fault");
    }
}

pub(crate) struct Request {
    pub(crate) key: StoreKey,
    pub(crate) document: NodeKey,
    pub(crate) bytes: usize,
}
impl Request {
    pub(crate) fn new(key: StoreKey, document: NodeKey) -> Self {
        let bytes = key
            .0
            .capacity()
            .saturating_mul(2)
            .saturating_add(document.0.capacity())
            .saturating_add(256)
            .saturating_add(mem::size_of::<Self>());
        Self {
            key,
            document,
            bytes,
        }
    }
}

pub(crate) struct Pending {
    pub(crate) queue: VecDeque<Request>,
    pub(crate) keys: BTreeSet<StoreKey>,
    pub(crate) bytes: usize,
    pub(crate) closed: bool,
    pub(crate) paused: bool,
    pub(crate) stats: StoreStats,
}

pub(crate) struct Shared {
    pub(crate) pending: Mutex<Pending>,
    pub(crate) ready: Condvar,
    pub(crate) disabled: AtomicBool,
    pub(crate) contended_drops: AtomicUsize,
    latest: [AtomicUsize; 8],
    sequence: AtomicUsize,
}

impl Shared {
    pub(crate) fn new(keys: usize, key_bytes: usize) -> Self {
        let queue = VecDeque::with_capacity(keys.min(key_bytes / mem::size_of::<Request>()));
        let bytes = queue.capacity() * mem::size_of::<Request>();
        Self {
            pending: Mutex::new(Pending {
                queue,
                keys: BTreeSet::new(),
                bytes,
                closed: false,
                paused: false,
                stats: StoreStats::default(),
            }),
            ready: Condvar::new(),
            disabled: AtomicBool::new(false),
            contended_drops: AtomicUsize::new(0),
            latest: std::array::from_fn(|_| AtomicUsize::new(0)),
            sequence: AtomicUsize::new(0),
        }
    }

    pub(crate) fn emit(&self, stats: StoreStats, observer: &dyn StoreObserver) {
        for (index, value) in [
            stats.hits,
            stats.misses,
            stats.faults,
            stats.writes,
            stats.bytes,
            stats.drops,
        ]
        .into_iter()
        .enumerate()
        {
            self.latest[index].store(value, Ordering::SeqCst);
        }
        self.latest[7].store(stats.active, Ordering::SeqCst);
        self.latest[6].store(stats.queued, Ordering::SeqCst);
        self.observe(observer);
    }

    pub(crate) fn observe(&self, observer: &dyn StoreObserver) {
        let mut stats = self.stats();
        stats.sequence = self.sequence.fetch_add(1, Ordering::SeqCst) + 1;
        observer.state(stats);
    }

    pub(crate) fn stats(&self) -> StoreStats {
        let queued = self.latest[6].load(Ordering::SeqCst);
        let active = self.latest[7].load(Ordering::SeqCst);
        StoreStats {
            sequence: self.sequence.load(Ordering::SeqCst),
            queued,
            active,
            hits: self.latest[0].load(Ordering::SeqCst),
            misses: self.latest[1].load(Ordering::SeqCst),
            faults: self.latest[2].load(Ordering::SeqCst),
            writes: self.latest[3].load(Ordering::SeqCst),
            bytes: self.latest[4].load(Ordering::SeqCst),
            drops: self.latest[5].load(Ordering::SeqCst)
                + self.contended_drops.load(Ordering::SeqCst),
        }
    }
}
