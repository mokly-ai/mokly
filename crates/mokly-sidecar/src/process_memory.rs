//! Cross-platform Node resident-set sum, including owned PostCSS processes.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use crate::error::Result;

/// Process resident memory, kept separate from process orchestration.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = MemoryMock))]
pub trait ResidentMemory: Send + Sync {
    /// Sum a sidecar and descendants with its Node executable; zero after exit.
    fn resident_bytes(&self, pid: u32) -> Result<u64>;
}

/// Host memory query for supported Linux, macOS, and Windows targets.
pub struct SystemMemory;

impl ResidentMemory for SystemMemory {
    fn resident_bytes(&self, pid: u32) -> Result<u64> {
        let mut system = System::new();
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing()
                .with_memory()
                .with_exe(UpdateKind::OnlyIfNotSet)
                .without_tasks(),
        );
        let records = system
            .processes()
            .iter()
            .map(|(pid, process)| {
                (
                    pid.as_u32(),
                    Sample {
                        parent: process.parent().map(Pid::as_u32),
                        bytes: process.memory(),
                        executable: process.exe(),
                    },
                )
            })
            .collect();
        Ok(tree_bytes(pid, &records))
    }
}

struct Sample<'a> {
    parent: Option<u32>,
    bytes: u64,
    executable: Option<&'a Path>,
}

fn tree_bytes(root: u32, records: &BTreeMap<u32, Sample<'_>>) -> u64 {
    let Some(sidecar) = records.get(&root) else {
        return 0;
    };
    let mut children: BTreeMap<u32, Vec<u32>> = BTreeMap::new();
    for (&pid, sample) in records {
        if let Some(parent) = sample.parent {
            children.entry(parent).or_default().push(pid);
        }
    }
    let mut pending = vec![root];
    let mut visited = BTreeSet::new();
    let mut total = 0u64;
    while let Some(pid) = pending.pop() {
        if !visited.insert(pid) {
            continue;
        }
        if let Some(sample) = records.get(&pid)
            && (pid == root
                || sidecar
                    .executable
                    .is_none_or(|exe| sample.executable == Some(exe)))
        {
            total = total.saturating_add(sample.bytes);
        }
        if let Some(descendants) = children.get(&pid) {
            pending.extend(descendants);
        }
    }
    total
}

#[cfg(test)]
#[path = "_tests_/process_memory_tests.rs"]
mod process_memory_tests;
