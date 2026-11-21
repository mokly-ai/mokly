//! Optional lossless document segments over the common cache publication rules.

use std::collections::{BTreeMap, VecDeque};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use arc_swap::ArcSwapOption;
use mokly_graph::document_store::{EntryFault, ReadOutcome, StoreKey};
use mokly_sidecar::bundle_store::RecordToken;

use crate::bundle_cache_types::{Mutation, RawRead};
use crate::cache::DiskCache;
use crate::error::Result;
use crate::render_segment_buffer::BuiltSegment;

/// Fixed production disk bound, independent of the process render cache.
pub const CAPACITY: u64 = 128 * 1024 * 1024;

/// A completed optional segment write.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WriteOutcome {
    /// Every document in the batch was durably published.
    Written(usize),
    /// Published documents remain valid after a maintenance fault.
    WrittenWithStoreFault(usize),
    /// A normal admission condition prevented publication.
    Skipped,
    /// A store fault disabled later operations.
    Unavailable,
}

/// Common raw cache operations, with inventory only at segment initialization.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SegmentCacheMock))]
pub trait SegmentCache: Send + Sync {
    /// Completed segments in oldest-first order, or none when initialization is contended.
    fn entries(&self) -> Result<Option<Vec<String>>>;
    /// Lease one segment without waiting for a lock.
    fn read(&self, key: &str) -> Result<RawRead>;
    /// Read segment metadata without changing its access order.
    fn inspect(&self, key: &str) -> Result<RawRead>;
    /// Publish one bounded durable segment.
    fn replace(&self, key: &str, bytes: &[u8]) -> Result<Mutation>;
    /// Reject only the observed publication.
    fn invalidate(&self, key: &str, token: Option<RecordToken>) -> Result<Mutation>;
}

/// Host render kind, sharing existing storage, locks, and durability.
pub struct RenderDisk {
    pub(crate) cache: Arc<DiskCache>,
    pub(crate) capacity: u64,
    pub(crate) ready: AtomicBool,
    pub(crate) initial: Mutex<Option<Vec<String>>>,
}

impl RenderDisk {
    /// Compose the common cache with a fixed byte bound.
    pub fn new(cache: Arc<DiskCache>, capacity: u64) -> Self {
        Self {
            cache,
            capacity,
            ready: AtomicBool::new(false),
            initial: Mutex::new(None),
        }
    }
}

/// Storage service used by the bounded writer and persistent reads.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DocumentBackendMock))]
pub trait DocumentBackend: Send + Sync {
    /// Build the startup index before the first document batch, without a render wait.
    fn initialize(&self) -> ReadOutcome {
        ReadOutcome::Miss
    }
    /// Read one complete document from its retained segment.
    fn load(&self, key: &StoreKey) -> ReadOutcome;
    /// Envelope version used by the appending writer.
    fn version(&self) -> &str;
    /// Publish an already built segment while its fixed workspace remains charged.
    fn save(&self, segment: &BuiltSegment<'_>) -> WriteOutcome;
}

/// Versioned segment reader with a process-local document index.
pub struct CachedDocuments {
    pub(crate) cache: Arc<dyn SegmentCache>,
    pub(crate) version: String,
    /// Complete bounded metadata, absent until startup inventory has finished.
    pub(crate) index: ArcSwapOption<BTreeMap<StoreKey, SegmentPosition>>,
    /// Startup, writer inspection, and adoption publish only while this owner is held.
    pub(crate) maintenance: Mutex<()>,
    pub(crate) faults: Mutex<VecDeque<EntryFault>>,
    pub(crate) enabled: AtomicBool,
}

#[derive(Clone)]
pub(crate) struct SegmentPosition {
    pub(crate) segment: Arc<SegmentIdentity>,
    pub(crate) offset: u64,
    pub(crate) length: u64,
    pub(crate) digest: String,
}

pub(crate) struct SegmentIdentity {
    pub(crate) key: String,
    pub(crate) header_digest: [u8; 32],
    pub(crate) token: RecordToken,
    pub(crate) bytes: u64,
    pub(crate) start: u64,
}

impl CachedDocuments {
    /// Keep the graph boundary independent of segment granularity.
    pub fn new(cache: Arc<dyn SegmentCache>, version: String) -> Self {
        Self {
            cache,
            version,
            index: ArcSwapOption::empty(),
            maintenance: Mutex::new(()),
            faults: Mutex::new(VecDeque::new()),
            enabled: AtomicBool::new(true),
        }
    }
}

impl DocumentBackend for CachedDocuments {
    fn initialize(&self) -> ReadOutcome {
        self.prepare_documents()
    }
    fn load(&self, key: &StoreKey) -> ReadOutcome {
        self.read_document(key)
    }
    fn version(&self) -> &str {
        &self.version
    }
    fn save(&self, segment: &BuiltSegment<'_>) -> WriteOutcome {
        self.save_segment(segment)
    }
}

#[cfg(test)]
#[path = "_tests_/render_store_boundary_tests.rs"]
mod render_store_boundary_tests;

#[cfg(test)]
#[path = "_tests_/render_store_fault_tests.rs"]
mod render_store_fault_tests;

#[cfg(test)]
#[path = "_tests_/render_store_concurrency_tests.rs"]
mod render_store_concurrency_tests;

#[cfg(test)]
#[path = "_tests_/render_store_adoption_tests.rs"]
mod render_store_adoption_tests;
