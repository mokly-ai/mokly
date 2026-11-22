//! Optional complete-document persistence, independent of storage granularity.

use std::sync::Arc;

use mokly_model::material::digest;

use crate::cache::Artifact;
use crate::key::NodeKey;
use crate::store_memory::StoreMemory;

/// A document key combined with the complete build identity of its composition.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct StoreKey(pub String);

impl StoreKey {
    /// Combine a prepared document key with a known complete build identity.
    pub fn new(document: &NodeKey, build: &str) -> Self {
        Self(digest(
            format!("{}:{}:{}", document.0.len(), document.0, build).as_bytes(),
        ))
    }
}

/// An entry-local failure never disables unrelated documents.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EntryFault {
    /// Invalid structure, size, digest, or document data.
    Damaged,
    /// Another format or Mokly version.
    Foreign,
    /// An entry file could not be read.
    Unreadable,
}

/// An optional persistent lookup.
#[derive(Debug)]
pub enum ReadOutcome {
    /// Exact composition, before side-specific validation.
    Hit(Arc<Artifact>),
    /// Valid bytes remain usable after access-order maintenance fails.
    HitWithStoreFault(Arc<Artifact>),
    /// Absent, contended, cancelled, or disabled storage.
    Miss,
    /// Rejected entry. The next render still uses sources.
    Rejected(EntryFault),
    /// Entry rejection and its retirement also produced a store fault.
    RejectedWithStoreFault(EntryFault),
    /// The first store fault. Later lookups are ordinary misses.
    Unavailable,
}

/// Admission never waits for a writer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OfferOutcome {
    /// The bounded pending set accepted the key.
    Queued,
    /// The key is already pending or stored.
    Present,
    /// No admission room, document, or enabled store is available.
    Dropped,
}

/// Persistent counters remain separate from process-cache hit semantics.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct StoreStats {
    /// Known owner capacities and separately named conservative charges.
    pub memory: StoreMemory,
    /// Monotonic diagnostic event order across admission and completion threads.
    pub sequence: usize,
    /// Successful persistent document reads.
    pub hits: usize,
    /// Persistent lookups that did not serve a document.
    pub misses: usize,
    /// Rejected persistent entries.
    pub faults: usize,
    /// Documents durably retained by this writer.
    pub writes: usize,
    /// Bytes durably published by this writer.
    pub bytes: usize,
    /// Offered keys that could not be retained.
    pub drops: usize,
    /// Keys waiting for the writer.
    pub queued: usize,
    /// Keys in the active writer batch.
    pub active: usize,
}

/// Graph-owned optional store boundary. Implementations retain no queued document handles.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DocumentStoreMock))]
pub trait DocumentStore: Send + Sync {
    /// Complete native build context, absent until optional preparation finishes.
    fn identity(&self) -> Option<String> {
        None
    }
    /// Probe prepared storage metadata without IO, restoration, or access-order changes.
    fn contains(&self, _key: &StoreKey) -> bool {
        false
    }
    /// Release optional writes after the first completed Changes publication.
    fn resume(&self) {}
    /// Read without bypassing the caller's current-side validation.
    fn load(&self, key: &StoreKey) -> ReadOutcome;
    /// Offer a process-cache key without waiting for pending-set or disk work, or encoding.
    fn offer(&self, key: StoreKey, document: NodeKey) -> OfferOutcome;
    /// Observe independent persistent counters and writer state.
    fn stats(&self) -> StoreStats;
    /// Stop admission and discard pending writes.
    fn stop(&self);
}

/// Command-owned store and stable extra identity of one sidecar generation.
#[derive(Clone)]
pub struct Persistence {
    /// Shared optional storage for head and base compositions.
    pub store: Arc<dyn DocumentStore>,
    /// Toolchain and compilation metadata, absent for an ineligible sidecar generation.
    pub javascript: Option<String>,
}

impl std::fmt::Debug for Persistence {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Persistence")
            .finish_non_exhaustive()
    }
}
