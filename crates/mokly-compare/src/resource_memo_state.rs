//! Bounded LRU values and metadata-only comparison facts.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::rules::RuleDiff;
use mokly_model::review_affected::ReviewSide;

use crate::resource_memo::{ResourceFact, ResourceWork};

#[derive(Clone, Eq, Ord, PartialEq, PartialOrd)]
pub(crate) struct PairKey(String, String, BTreeMap<String, String>);

impl PairKey {
    pub(crate) fn new(before: &str, after: &str, aliases: &BTreeMap<String, String>) -> Self {
        Self(before.into(), after.into(), aliases.clone())
    }
}

pub(crate) struct MemoState {
    pub(crate) facts: BTreeMap<(ReviewSide, String), ResourceFact>,
    pub(crate) bytes: Bounded<(ReviewSide, String), Arc<[u8]>>,
    pub(crate) equal: BTreeMap<PairKey, bool>,
    pub(crate) diffs: Bounded<(String, String), Arc<RuleDiff>>,
    pub(crate) diff_keys: BTreeMap<PairKey, (String, String)>,
    pub(crate) work: ResourceWork,
    pub(crate) fingerprints:
        BTreeMap<(ReviewSide, String, BTreeMap<String, String>), Option<String>>,
}

impl MemoState {
    pub(crate) fn new(bound: usize) -> Self {
        Self {
            facts: BTreeMap::new(),
            bytes: Bounded::new(bound),
            equal: BTreeMap::new(),
            diffs: Bounded::new(bound),
            diff_keys: BTreeMap::new(),
            work: ResourceWork::default(),
            fingerprints: BTreeMap::new(),
        }
    }
}

/// Pure value container; the owning service supplies locking and IO.
pub(crate) struct Bounded<K, V> {
    bound: usize,
    bytes: usize,
    sequence: u128,
    values: BTreeMap<K, (u128, usize, V)>,
    order: BTreeMap<u128, K>,
}

impl<K: Ord + Clone, V: Clone> Bounded<K, V> {
    pub(crate) fn new(bound: usize) -> Self {
        Self {
            bound,
            bytes: 0,
            sequence: 0,
            values: BTreeMap::new(),
            order: BTreeMap::new(),
        }
    }
    pub(crate) fn bytes(&self) -> usize {
        self.bytes
    }
    pub(crate) fn get(&mut self, key: &K) -> Option<V> {
        let (old, _, value) = self.values.get_mut(key)?;
        self.order.remove(old);
        self.sequence += 1;
        *old = self.sequence;
        self.order.insert(*old, key.clone());
        Some(value.clone())
    }
    pub(crate) fn insert(&mut self, key: K, value: V, cost: usize) {
        if cost > self.bound || self.values.contains_key(&key) {
            return;
        }
        while self.bytes > self.bound - cost {
            let Some((_, key)) = self.order.pop_first() else {
                break;
            };
            if let Some((_, cost, _)) = self.values.remove(&key) {
                self.bytes -= cost;
            }
        }
        self.sequence += 1;
        self.bytes += cost;
        self.order.insert(self.sequence, key.clone());
        self.values.insert(key, (self.sequence, cost, value));
    }
}
