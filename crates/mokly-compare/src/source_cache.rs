//! Per-file source LRU accounts for bytes and keys without holding locks across Git IO.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

pub(crate) struct SourceCache {
    bound: usize,
    bytes: usize,
    sequence: u128,
    entries: BTreeMap<RepoPath, (u128, Vec<u8>)>,
    order: BTreeMap<u128, RepoPath>,
}

impl SourceCache {
    pub(crate) fn new(bound: usize) -> Self {
        Self {
            bound,
            bytes: 0,
            sequence: 0,
            entries: BTreeMap::new(),
            order: BTreeMap::new(),
        }
    }
    pub(crate) fn contains(&self, path: &RepoPath) -> bool {
        self.entries.contains_key(path)
    }
    pub(crate) fn get(&mut self, path: &RepoPath) -> Option<Vec<u8>> {
        let (sequence, bytes) = self.entries.get_mut(path)?;
        self.order.remove(sequence);
        self.sequence += 1;
        *sequence = self.sequence;
        self.order.insert(*sequence, path.clone());
        Some(bytes.clone())
    }
    pub(crate) fn insert(&mut self, path: RepoPath, bytes: Vec<u8>) {
        if self.entries.contains_key(&path) {
            return;
        }
        let cost = bytes
            .capacity()
            .saturating_add(path.as_str().len())
            .saturating_add(128);
        if cost > self.bound {
            return;
        }
        while self.bytes > self.bound - cost {
            let Some((_, oldest)) = self.order.pop_first() else {
                break;
            };
            if let Some((_, bytes)) = self.entries.remove(&oldest) {
                self.bytes -= bytes.capacity() + oldest.as_str().len() + 128;
            }
        }
        self.sequence += 1;
        self.bytes += cost;
        self.order.insert(self.sequence, path.clone());
        self.entries.insert(path, (self.sequence, bytes));
    }
}
