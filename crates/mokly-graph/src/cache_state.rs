//! Both tiers share one total charge while compact documents have a separate ceiling.

use std::sync::Arc;

use crate::cache::{Artifact, CacheStats};
use crate::cache_tier::Tier;
use crate::document_codec::EncodedView;
use crate::key::NodeKey;

/// Locked ownership, charges, and operation counts for both tiers.
pub(crate) struct State {
    /// Full artifacts use all capacity that compact documents do not retain.
    pub(crate) full: Tier<Artifact>,
    /// Compressed documents retain at most their ceiling.
    pub(crate) compact: Tier<EncodedView>,
    /// Cumulative operation counts; totals are derived from the tiers.
    pub(crate) stats: CacheStats,
    /// Wrapping sequence of public reads and writes.
    pub(crate) operations: u128,
    total: usize,
}

impl State {
    /// Start with no compact reservation and clip the ceiling to the total.
    pub(crate) fn new(total: usize, compact_ceiling: usize) -> Self {
        Self {
            full: Tier::new(total),
            compact: Tier::new(compact_ceiling.min(total)),
            stats: CacheStats::default(),
            operations: 0,
            total,
        }
    }

    /// Statistics reads and internal demotions are not cache operations.
    pub(crate) fn operation(&mut self) {
        self.operations = self.operations.wrapping_add(1);
    }

    /// Remove the same compact value and release its capacity to the full tier.
    pub(crate) fn remove_compact(&mut self, key: &NodeKey, value: &Arc<EncodedView>) -> bool {
        let removed = self.compact.remove_same(key, value);
        self.full.bound = self.total - self.compact.bytes;
        removed
    }

    /// Retain a full artifact and return entries that need compaction.
    pub(crate) fn insert_full(
        &mut self,
        key: NodeKey,
        value: Arc<Artifact>,
        cost: usize,
    ) -> Vec<(NodeKey, Arc<Artifact>)> {
        if cost > self.total {
            let removed = self.full.remove(&key).is_some();
            self.stats.evictions = self.stats.evictions.saturating_add(usize::from(removed));
            return Vec::new();
        }
        while cost > self.total - self.compact.bytes {
            if self.compact.oldest().is_none() {
                break;
            }
            self.stats.evictions = self.stats.evictions.saturating_add(1);
        }
        self.full.bound = self.total - self.compact.bytes;
        self.full.insert(key, value, cost)
    }

    /// Admit a compressed document and return any displaced full artifacts.
    pub(crate) fn insert_compact(
        &mut self,
        key: NodeKey,
        value: Arc<EncodedView>,
        cost: usize,
    ) -> Vec<(NodeKey, Arc<Artifact>)> {
        let evictions = self.compact.insert(key, value, cost).len();
        self.stats.evictions = self.stats.evictions.saturating_add(evictions);
        self.full.bound = self.total - self.compact.bytes;
        self.full.trim()
    }
}
