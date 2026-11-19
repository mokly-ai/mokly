//! Full and compact tiers share capacity outside fixed compaction headroom.

use std::sync::{Arc, Mutex};

use crate::cache::{Artifact, CacheStats};
use crate::cache_encoder_pool::EncoderPool;
use crate::cache_tier::{Evicted, Tier};
use crate::cache_transit::Transit;
use crate::document_codec::EncodedView;
use crate::key::NodeKey;

/// Locked ownership, charges, and operation counts for retained and transit entries.
pub(crate) struct State {
    /// Full artifacts use capacity outside compact documents and transit headroom.
    pub(crate) full: Tier<Artifact>,
    /// Compressed documents retain at most their ceiling.
    pub(crate) compact: Tier<EncodedView>,
    /// Readable documents reserve their charge and twice that charge for encoding.
    pub(crate) transit: Tier<Artifact>,
    /// Reserved encoder slots retain their workspace charge while idle.
    pub(crate) encoders: EncoderPool,
    /// Cumulative operation counts; totals include transit reservations.
    pub(crate) stats: CacheStats,
    /// Wrapping sequence of public reads and writes.
    pub(crate) operations: u128,
    retained: usize,
    pub(crate) leased: usize,
}

impl State {
    /// Reserve one sixteenth of the total for compaction, including its workspace.
    pub(crate) fn new(total: usize, compact_ceiling: usize, workspace: usize) -> Self {
        let headroom = total / 16;
        let retained = total - headroom;
        Self {
            full: Tier::new(retained),
            compact: Tier::new(compact_ceiling.min(retained)),
            transit: Tier::new(headroom),
            encoders: EncoderPool::new(workspace),
            stats: CacheStats::default(),
            operations: 0,
            retained,
            leased: 0,
        }
    }

    /// Active transient owners consume retained space, never compaction headroom.
    pub(crate) fn available(&self) -> usize {
        self.retained - self.leased
    }

    /// Admission only evicts. It never encodes a document or waits for another lease.
    pub(crate) fn reserve_bytes(&mut self, bytes: usize) -> bool {
        if bytes > self.available() {
            return false;
        }
        let remaining = self.available() - bytes;
        while self.compact.bytes > remaining {
            self.compact.oldest();
            self.stats.evictions = self.stats.evictions.saturating_add(1);
        }
        while self.full.bytes > remaining - self.compact.bytes {
            self.full.oldest();
            self.stats.evictions = self.stats.evictions.saturating_add(1);
        }
        self.leased += bytes;
        self.full.bound = remaining - self.compact.bytes;
        true
    }

    /// Statistics reads and internal demotions are not cache operations.
    pub(crate) fn operation(&mut self) {
        self.operations = self.operations.wrapping_add(1);
    }

    /// Remove the same compact value and release its capacity to the full tier.
    pub(crate) fn remove_compact(&mut self, key: &NodeKey, value: &Arc<EncodedView>) -> bool {
        let removed = self.compact.remove_same(key, value);
        self.full.bound = self.available() - self.compact.bytes;
        removed
    }

    /// Reserve evictions before retaining their replacement. Inserts never wait.
    pub(crate) fn insert_full<'a>(
        &mut self,
        owner: &'a Mutex<Self>,
        key: NodeKey,
        value: Arc<Artifact>,
        cost: usize,
    ) -> Vec<Transit<'a>> {
        if cost > self.available() {
            let removed = self.full.remove(&key).is_some();
            self.stats.evictions = self.stats.evictions.saturating_add(usize::from(removed));
            return Vec::new();
        }
        while cost > self.available() - self.compact.bytes {
            if self.compact.oldest().is_none() {
                break;
            }
            self.stats.evictions = self.stats.evictions.saturating_add(1);
        }
        self.full.remove(&key);
        let mut pending = self.trim_full(owner, self.available() - self.compact.bytes - cost);
        self.full.bound = self.available() - self.compact.bytes;
        for entry in self.full.insert(key, value, cost) {
            if let Some(reservation) = self.reserve(owner, entry) {
                pending.push(reservation);
            }
        }
        pending
    }

    /// Trim before admission so the retained charge never consumes headroom.
    pub(crate) fn insert_compact<'a>(
        &mut self,
        owner: &'a Mutex<Self>,
        key: NodeKey,
        value: Arc<EncodedView>,
        cost: usize,
    ) -> Vec<Transit<'a>> {
        if cost > self.compact.bound.min(self.available()) {
            self.stats.evictions = self.stats.evictions.saturating_add(1);
            return Vec::new();
        }
        while self.compact.bytes > self.compact.bound.min(self.available()) - cost {
            if self.compact.oldest().is_none() {
                break;
            }
            self.stats.evictions = self.stats.evictions.saturating_add(1);
        }
        let bound = self.available() - self.compact.bytes - cost;
        let pending = self.trim_full(owner, bound);
        self.full.bound = bound;
        self.compact.insert(key, value, cost);
        pending
    }

    fn trim_full<'a>(&mut self, owner: &'a Mutex<Self>, bound: usize) -> Vec<Transit<'a>> {
        let mut pending = Vec::new();
        while self.full.bytes > bound {
            let Some(entry) = self.full.oldest() else {
                break;
            };
            if let Some(reservation) = self.reserve(owner, entry) {
                pending.push(reservation);
            }
        }
        pending
    }

    fn reserve<'a>(
        &mut self,
        owner: &'a Mutex<Self>,
        entry: Evicted<Artifact>,
    ) -> Option<Transit<'a>> {
        let charge = entry.cost.checked_mul(3);
        let headroom = self.transit.bound - self.transit.bytes - self.encoders.bytes;
        if self.compact.bound > 0
            && entry.value.document.is_some()
            && let Some(charge) = charge.filter(|charge| *charge <= headroom)
            && let Some(lease) = self.encoders.take(headroom - charge)
        {
            self.transit
                .insert(entry.key.clone(), entry.value.clone(), charge);
            return Some(Transit::new(owner, entry.key, entry.value, lease));
        }
        self.stats.evictions = self.stats.evictions.saturating_add(1);
        None
    }
}
