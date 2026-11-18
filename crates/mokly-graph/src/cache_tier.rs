//! Charged entries and access order for one bounded cache tier.

use std::collections::BTreeMap;
use std::mem;
use std::sync::Arc;

use crate::key::NodeKey;

struct Entry<T> {
    access: u128,
    restored_at: Option<u128>,
    value: Arc<T>,
    cost: usize,
}

/// A released entry keeps the charge recorded when it entered the tier.
pub(crate) struct Evicted<T> {
    /// Released key.
    pub(crate) key: NodeKey,
    /// Released value.
    pub(crate) value: Arc<T>,
    /// Original retained charge.
    pub(crate) cost: usize,
}

/// One bounded set of values with independent charge and access order.
pub(crate) struct Tier<T> {
    values: BTreeMap<NodeKey, Entry<T>>,
    order: BTreeMap<u128, NodeKey>,
    next: u128,
    /// Charge of all retained entries.
    pub(crate) bytes: usize,
    /// Maximum retained charge.
    pub(crate) bound: usize,
}

impl<T> Tier<T> {
    /// Construct an empty tier.
    pub(crate) fn new(bound: usize) -> Self {
        Self {
            values: BTreeMap::new(),
            order: BTreeMap::new(),
            next: 0,
            bytes: 0,
            bound,
        }
    }

    /// Number of retained keys.
    pub(crate) fn len(&self) -> usize {
        self.values.len()
    }

    /// Whether this tier owns the key.
    pub(crate) fn contains(&self, key: &NodeKey) -> bool {
        self.values.contains_key(key)
    }

    /// Refresh an identical handle only when replacement would keep its key charge.
    pub(crate) fn refresh_same(&mut self, key: &NodeKey, value: &Arc<T>) -> bool {
        let same = self
            .values
            .get_key_value(key)
            .is_some_and(|(stored, entry)| {
                stored.0.capacity() == key.0.capacity() && Arc::ptr_eq(&entry.value, value)
            });
        if same {
            self.get(key);
        }
        same
    }

    /// Read and promote a retained value without changing its recorded charge.
    pub(crate) fn get(&mut self, key: &NodeKey) -> Option<Arc<T>> {
        let (stored, mut entry) = self.values.remove_entry(key)?;
        self.order.remove(&entry.access);
        entry.access = self.access();
        self.order.insert(entry.access, stored.clone());
        let value = entry.value.clone();
        self.values.insert(stored, entry);
        Some(value)
    }

    /// Remove the key and its recorded charge.
    pub(crate) fn remove(&mut self, key: &NodeKey) -> Option<Arc<T>> {
        let entry = self.values.remove(key)?;
        self.order.remove(&entry.access);
        self.bytes -= entry.cost;
        Some(entry.value)
    }

    /// Remove a failed value only if another insertion has not replaced it.
    pub(crate) fn remove_same(&mut self, key: &NodeKey, value: &Arc<T>) -> bool {
        if self
            .values
            .get(key)
            .is_some_and(|entry| Arc::ptr_eq(&entry.value, value))
        {
            self.remove(key);
            return true;
        }
        false
    }

    /// Remember a successful restore and report reuse within the full-tier turnover.
    pub(crate) fn restored(
        &mut self,
        key: &NodeKey,
        value: &Arc<T>,
        operation: u128,
        turnover: usize,
    ) -> bool {
        let Some(entry) = self.values.get_mut(key) else {
            return false;
        };
        if !Arc::ptr_eq(&entry.value, value) {
            return false;
        }
        let recent = entry
            .restored_at
            .is_some_and(|previous| operation.wrapping_sub(previous) < turnover as u128);
        entry.restored_at = Some(operation);
        recent
    }

    /// Remove the least recently accessed entry.
    pub(crate) fn oldest(&mut self) -> Option<Evicted<T>> {
        let (_, key) = self.order.pop_first()?;
        let entry = self.values.remove(&key)?;
        self.bytes -= entry.cost;
        Some(Evicted {
            key,
            value: entry.value,
            cost: entry.cost,
        })
    }

    /// Return capacity evictions, but do not count replacement as an eviction.
    pub(crate) fn insert(&mut self, key: NodeKey, value: Arc<T>, cost: usize) -> Vec<Evicted<T>> {
        self.remove(&key);
        if cost > self.bound {
            return vec![Evicted { key, value, cost }];
        }
        let mut evicted = Vec::new();
        while self.bytes > self.bound - cost {
            let Some(entry) = self.oldest() else {
                break;
            };
            evicted.push(entry);
        }
        let access = self.access();
        self.order.insert(access, key.clone());
        self.values.insert(
            key,
            Entry {
                access,
                restored_at: None,
                value,
                cost,
            },
        );
        self.bytes += cost;
        evicted
    }

    /// Renumber access order before the sequence can overflow.
    fn access(&mut self) -> u128 {
        if self.next == u128::MAX {
            self.next = 0;
            for key in mem::take(&mut self.order).into_values() {
                if let Some(entry) = self.values.get_mut(&key) {
                    entry.access = self.next;
                    self.order.insert(self.next, key);
                    self.next += 1;
                }
            }
        }
        let access = self.next;
        self.next += 1;
        access
    }
}
