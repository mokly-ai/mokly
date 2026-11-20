//! Bounded pending keys and ordered writer-state diagnostics.

use std::collections::{BTreeSet, VecDeque};
use std::mem;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, MutexGuard};

use mokly_graph::document_store::{EntryFault, StoreKey, StoreStats};
use mokly_graph::export_memory::ExportBuffer;
use mokly_graph::key::NodeKey;

use crate::render_admission::Admission;
use crate::render_memory;

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
            hits = stats.hits, misses = stats.misses, faults = stats.faults, writes = stats.writes, bytes = stats.bytes, drops = stats.drops,
            memory_queue_peak = stats.memory.queue_peak, memory_segment_peak = stats.memory.segment_peak,
            memory_export_peak = stats.memory.export_peak, memory_codec_peak = stats.memory.codec_peak,
            memory_known = stats.memory.known, memory_known_peak = stats.memory.known_peak,
            queue_bookkeeping_charge = stats.memory.queue_bookkeeping_charge, codec_charge_peak = stats.memory.codec_charge_peak);
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
    pub(crate) stats: StoreStats,
    pub(crate) strings: usize,
    pub(crate) active_capacity: usize,
}

impl Pending {
    pub(crate) fn sample(&mut self) {
        self.stats.memory.queue = mem::size_of::<Self>()
            + self.queue.capacity() * mem::size_of::<Request>()
            + self.active_capacity
            + self.strings;
        self.stats.memory.queue_bookkeeping_charge = self.keys.len() * 256;
    }
    pub(crate) fn release(&mut self, request: &Request) {
        self.bytes -= request.bytes;
        self.strings -= request.key.0.capacity() + request.document.0.capacity();
        if let Some(key) = self.keys.take(&request.key) {
            self.strings -= key.0.capacity();
        }
    }
}

/// A read's accounting locks, with publication reserved only for a miss hint.
pub(crate) struct ReadState<'a> {
    /// Existing pending counters, held through publication and observer delivery.
    pub(crate) pending: MutexGuard<'a, Pending>,
    publication: Option<MutexGuard<'a, Publication>>,
}

impl ReadState<'_> {
    /// Publish once without reacquiring a hint's reserved publication lock.
    pub(crate) fn emit(&mut self, shared: &Shared, observer: &dyn StoreObserver) {
        let snapshot = {
            let Some(mut publication) = self.publication.take() else {
                shared.emit(self.pending.stats, observer);
                return;
            };
            publication.publish(self.pending.stats)
        };
        observer.state(snapshot);
    }
}

pub(crate) struct Shared {
    pub(crate) pending: Mutex<Pending>,
    pub(crate) admission: Arc<Admission>,
    pub(crate) disabled: AtomicBool,
    publication: Mutex<Publication>,
}

impl Shared {
    pub(crate) fn new(keys: usize, key_bytes: usize, paused: bool) -> Self {
        let queue = VecDeque::with_capacity(keys.min(key_bytes / mem::size_of::<Request>()));
        let bytes = queue.capacity() * mem::size_of::<Request>();
        let mut stats = StoreStats::default();
        stats.memory.queue = mem::size_of::<Pending>() + bytes;
        stats.memory.sample();
        Self {
            pending: Mutex::new(Pending {
                queue,
                keys: BTreeSet::new(),
                bytes,
                closed: false,
                stats,
                strings: 0,
                active_capacity: 0,
            }),
            admission: Arc::new(Admission::new(paused)),
            disabled: AtomicBool::new(false),
            publication: Mutex::new(Publication {
                snapshot: stats,
                contended_drops: 0,
            }),
        }
    }

    /// Keep ordinary loads on their existing blocking accounting path.
    pub(crate) fn read_state(&self) -> ReadState<'_> {
        ReadState {
            pending: self
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner()),
            publication: None,
        }
    }

    /// Decline a hint before any outcome is counted when either lock is held.
    pub(crate) fn try_read_state(&self) -> Option<ReadState<'_>> {
        let pending = self.pending.try_lock().ok()?;
        let publication = self.publication.try_lock().ok()?;
        Some(ReadState {
            pending,
            publication: Some(publication),
        })
    }

    pub(crate) fn emit(&self, stats: StoreStats, observer: &dyn StoreObserver) {
        let snapshot = {
            let mut publication = self
                .publication
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            publication.publish(stats)
        };
        observer.state(snapshot);
    }

    pub(crate) fn contended(&self, observer: &dyn StoreObserver) {
        let snapshot = {
            let mut publication = self
                .publication
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            publication.contended_drops += 1;
            publication.snapshot.drops += 1;
            publication.snapshot.sequence += 1;
            publication.snapshot
        };
        observer.state(snapshot);
    }

    pub(crate) fn stats(&self) -> StoreStats {
        self.publication
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .snapshot
    }

    pub(crate) fn memory(&self, buffer: Option<ExportBuffer>, bytes: usize) {
        let mut publication = self
            .publication
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        render_memory::update(&mut publication.snapshot.memory, buffer, bytes);
        publication.snapshot.sequence += 1;
    }
}

#[derive(Default)]
struct Publication {
    snapshot: StoreStats,
    contended_drops: usize,
}

impl Publication {
    fn publish(&mut self, mut stats: StoreStats) -> StoreStats {
        let queue = stats.memory.queue;
        let charge = stats.memory.queue_bookkeeping_charge;
        stats.memory = self.snapshot.memory;
        stats.memory.queue = queue;
        stats.memory.queue_bookkeeping_charge = charge;
        stats.memory.sample();
        stats.sequence = self.snapshot.sequence + 1;
        stats.drops += self.contended_drops;
        self.snapshot = stats;
        stats
    }
}

#[cfg(test)]
#[path = "_tests_/render_read_accounting_tests.rs"]
mod render_read_accounting_tests;
