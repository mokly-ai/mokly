//! A byte-bounded store of stylesheet records, their context entries, and the reasons for the
//! keys whose records it could not keep.

use std::collections::BTreeMap;
use std::sync::Arc;

use crate::stylesheet_record::{ContextEvidence, Record};

/// Why the cache could not serve a stylesheet: the `cache` field of its `css.bundle` span.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Miss {
    /// No record for the key exists.
    NoRecord,
    /// The byte bound removed the record or kept it out.
    Evicted,
    /// An input of the record changed.
    StampMismatch,
    /// The read evidence of the earlier bundle disagreed, so its record stayed in its attempt.
    InconsistentEvidence,
}

enum Charge<'a> {
    Record { key: &'a String, record: &'a Record },
    Context(&'a ContextEvidence),
    Miss(&'a String),
}

impl Miss {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::NoRecord => "no-record",
            Self::Evicted => "evicted",
            Self::StampMismatch => "stamp-mismatch",
            Self::InconsistentEvidence => "inconsistent-evidence",
        }
    }
}

pub(crate) struct StylesheetCache {
    records: BTreeMap<String, Arc<Record>>,
    /// The distinct context entries of the records. The store charges each entry once.
    contexts: Vec<Arc<ContextEvidence>>,
    misses: BTreeMap<String, Miss>,
    limit: usize,
}

impl Default for StylesheetCache {
    fn default() -> Self {
        Self::new(64 * 1024 * 1024)
    }
}

impl StylesheetCache {
    pub(crate) fn new(limit: usize) -> Self {
        Self {
            records: BTreeMap::new(),
            contexts: Vec::new(),
            misses: BTreeMap::new(),
            limit,
        }
    }

    pub(crate) fn empty_peer(&self) -> Self {
        Self::new(self.limit)
    }

    pub(crate) fn record(&self, key: &str) -> Option<Arc<Record>> {
        self.records.get(key).cloned()
    }

    /// A stored context entry with this evidence digest.
    pub(crate) fn context(&self, digest: &str) -> Option<Arc<ContextEvidence>> {
        self.contexts
            .iter()
            .find(|context| context.digest == digest)
            .cloned()
    }

    /// The reason that a lookup of `key` without a record reports.
    pub(crate) fn miss(&self, key: &str) -> Miss {
        self.misses.get(key).copied().unwrap_or(Miss::NoRecord)
    }

    /// Remember that the record of `key` stayed in its attempt.
    pub(crate) fn reject(&mut self, key: String) {
        self.records.remove(&key);
        self.prune();
        self.misses.insert(key, Miss::InconsistentEvidence);
        self.trim_misses();
    }

    pub(crate) fn insert(&mut self, key: String, record: Arc<Record>) {
        self.records.remove(&key);
        self.misses.remove(&key);
        self.prune();
        let alone = Self::charge(Charge::Record {
            key: &key,
            record: &record,
        }) + record
            .context
            .as_ref()
            .map_or(0, |context| Self::charge(Charge::Context(context)));
        if alone > self.limit {
            self.misses.insert(key, Miss::Evicted);
        } else {
            if self.retained() + self.record_charge(&key, &record) > self.limit {
                self.evict();
            }
            if let Some(context) = &record.context
                && !self.holds(context)
            {
                self.contexts.push(context.clone());
            }
            self.records.insert(key, record);
        }
        self.trim_misses();
    }

    /// The bytes that a record adds: its key, itself, and its context entry when not yet held.
    /// A record also fits after an eviction, because `insert` checks it with its entry first.
    fn record_charge(&self, key: &String, record: &Record) -> usize {
        Self::charge(Charge::Record { key, record })
            + record
                .context
                .as_ref()
                .filter(|context| !self.holds(context))
                .map_or(0, |context| Self::charge(Charge::Context(context)))
    }

    fn charge(owner: Charge<'_>) -> usize {
        match owner {
            Charge::Record { key, record } => size_of::<String>() + key.capacity() + record.bytes,
            Charge::Context(context) => context.bytes,
            Charge::Miss(key) => size_of::<(String, Miss)>() + key.capacity(),
        }
    }

    fn holds(&self, context: &Arc<ContextEvidence>) -> bool {
        self.contexts.iter().any(|held| Arc::ptr_eq(held, context))
    }

    /// Remove every record and context entry, and remember the removed keys.
    fn evict(&mut self) {
        let removed = std::mem::take(&mut self.records);
        self.contexts.clear();
        self.misses
            .extend(removed.into_keys().map(|key| (key, Miss::Evicted)));
    }

    /// Drop the context entries that no record uses.
    fn prune(&mut self) {
        let records = &self.records;
        self.contexts.retain(|context| {
            records.values().any(|record| {
                record
                    .context
                    .as_ref()
                    .is_some_and(|used| Arc::ptr_eq(used, context))
            })
        });
    }

    /// Forget every miss reason when the reasons no longer fit beside the records.
    fn trim_misses(&mut self) {
        if self.retained() > self.limit {
            self.misses.clear();
        }
    }

    fn retained(&self) -> usize {
        let records: usize = self
            .records
            .iter()
            .map(|(key, record)| Self::charge(Charge::Record { key, record }))
            .sum();
        let contexts: usize = self
            .contexts
            .iter()
            .map(|context| Self::charge(Charge::Context(context)))
            .sum();
        let misses: usize = self
            .misses
            .keys()
            .map(|key| Self::charge(Charge::Miss(key)))
            .sum();
        records + contexts + misses
    }
}

#[cfg(test)]
#[path = "_tests_/stylesheet_store_tests.rs"]
mod stylesheet_store_tests;
