//! Pure process ancestry and selected executable resident-memory accounting.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

#[derive(Clone)]
pub(crate) struct Sample {
    pub(crate) parent: Option<u32>,
    pub(crate) bytes: u64,
    pub(crate) executable: Option<PathBuf>,
    pub(crate) started: u64,
}

pub(crate) fn descendants(root: u32, records: &BTreeMap<u32, Sample>) -> BTreeSet<u32> {
    if !records.contains_key(&root) {
        return BTreeSet::new();
    }
    let mut children: BTreeMap<u32, Vec<u32>> = BTreeMap::new();
    for (&pid, sample) in records {
        if let Some(parent) = sample.parent {
            children.entry(parent).or_default().push(pid);
        }
    }
    let mut pending = vec![root];
    let mut visited = BTreeSet::new();
    while let Some(pid) = pending.pop() {
        if !visited.insert(pid) {
            continue;
        }
        if let Some(children) = children.get(&pid) {
            pending.extend(children);
        }
    }
    visited
}

pub(crate) fn tree_bytes(root: u32, records: &BTreeMap<u32, Sample>) -> u64 {
    let Some(sidecar) = records.get(&root) else {
        return 0;
    };
    descendants(root, records)
        .into_iter()
        .filter_map(|pid| {
            let sample = records.get(&pid)?;
            (pid == root
                || sidecar
                    .executable
                    .as_ref()
                    .is_none_or(|exe| sample.executable.as_ref() == Some(exe)))
            .then_some(sample.bytes)
        })
        .fold(0, u64::saturating_add)
}
