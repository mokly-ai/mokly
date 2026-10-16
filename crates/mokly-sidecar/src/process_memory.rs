//! Per-worker resident-memory sampling with bounded subtree refresh work.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Mutex;

use sysinfo::System;

use crate::error::Result;
use crate::memory_table::{ProcessTable, SystemTable};
use crate::memory_tree::{descendants, tree_bytes};

/// Resident memory of one owned sidecar and its Node descendants.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = MemoryMock))]
pub trait ResidentMemory: Send + Sync {
    /// Refresh known processes, or discover children after a PostCSS request.
    fn resident_bytes(&self, discover: bool) -> Result<u64>;
}

/// Each worker owns a separate process table and cached executable identities.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = MemoryFactoryMock))]
pub trait MemoryFactory: Send + Sync {
    /// Create a monitor and discover the initial process subtree.
    fn monitor(&self, pid: u32) -> Box<dyn ResidentMemory>;
}

/// Host memory monitor factory for Linux, macOS, and Windows.
pub struct SystemMemory;
impl MemoryFactory for SystemMemory {
    fn monitor(&self, pid: u32) -> Box<dyn ResidentMemory> {
        Box::new(Monitor::new(pid, Box::new(SystemTable(System::new()))))
    }
}

pub(crate) const RESCAN_REQUESTS: usize = 64;

struct Identity {
    started: u64,
    authored: Option<PathBuf>,
    canonical: Option<PathBuf>,
}
struct State {
    root: u32,
    table: Box<dyn ProcessTable>,
    known: Vec<u32>,
    identities: BTreeMap<u32, Identity>,
    requests: usize,
}

pub(crate) struct Monitor(Mutex<State>);
impl Monitor {
    pub(crate) fn new(root: u32, table: Box<dyn ProcessTable>) -> Self {
        let mut state = State {
            root,
            table,
            known: Vec::new(),
            identities: BTreeMap::new(),
            requests: 0,
        };
        state.sample(true);
        Self(Mutex::new(state))
    }
}
impl ResidentMemory for Monitor {
    fn resident_bytes(&self, discover: bool) -> Result<u64> {
        let mut state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        Ok(state.sample(discover))
    }
}
impl State {
    fn sample(&mut self, discover: bool) -> u64 {
        self.requests += 1;
        let full = discover || self.requests >= RESCAN_REQUESTS;
        let mut records = self
            .table
            .refresh(if full { None } else { Some(&self.known) });
        let owned = descendants(self.root, &records);
        if full {
            self.requests = 0;
        }
        self.known = owned.iter().copied().collect();
        self.identities.retain(|pid, _| owned.contains(pid));
        records.retain(|pid, _| owned.contains(pid));
        for (pid, record) in &mut records {
            let identity = self.identities.entry(*pid).or_insert_with(|| Identity {
                started: record.started,
                authored: record.executable.clone(),
                canonical: record
                    .executable
                    .as_deref()
                    .and_then(|path| self.table.canonicalize(path)),
            });
            if identity.started != record.started || identity.authored != record.executable {
                identity.started = record.started;
                identity.authored = record.executable.clone();
                identity.canonical = record
                    .executable
                    .as_deref()
                    .and_then(|path| self.table.canonicalize(path));
            }
            record.executable.clone_from(&identity.canonical);
        }
        tree_bytes(self.root, &records)
    }
}

#[cfg(test)]
#[path = "_tests_/memory_sampling_tests.rs"]
mod memory_sampling_tests;
#[cfg(test)]
#[path = "_tests_/process_memory_tests.rs"]
mod process_memory_tests;
