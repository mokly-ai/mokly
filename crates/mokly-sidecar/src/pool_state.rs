//! FIFO process leasing and generation replay state.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::path::PathBuf;
use std::sync::Arc;

use crate::bindings::Bindings;
use crate::compiled::CompiledGeneration;
use crate::memory_schedule::MemorySchedule;
use crate::methods::{Bundle, CssModules};
use crate::pool_head::Head;
use crate::pool_recipes::Recipes;
use crate::pool_timing::Reason;
use crate::results::Module;
use crate::workers::{Worker, WorkerControl};

pub(super) struct Slot {
    pub(super) source_root: PathBuf,
    pub(super) worker: Box<dyn Worker>,
    pub(super) control: Arc<dyn WorkerControl>,
    pub(super) generations: BTreeMap<String, u64>,
    pub(super) maps: BTreeSet<String>,
    pub(super) described: BTreeSet<String>,
    pub(super) bindings: BTreeMap<String, Arc<Bindings>>,
    pub(super) contexts: BTreeSet<String>,
    pub(super) renders: u64,
    pub(super) requests: u64,
    /// Epoch of the last head bundle whose cache outcome indicates compilation.
    pub(super) last_compilation: Option<u64>,
}

/// A context keeps its source identity even while its recycled slot has no process.
pub(super) struct Affinity {
    /// The slot that owns this context's PostCSS process.
    pub(super) index: usize,
    /// The source root whose worker may restore the context.
    pub(super) source_root: PathBuf,
}

pub(super) struct Waiting {
    pub(super) context: Option<String>,
    pub(super) root: PathBuf,
    pub(super) claim: Option<u64>,
}

#[derive(Default)]
pub(super) struct State {
    pub(super) head: Head,
    pub(super) source_roots: BTreeMap<usize, PathBuf>,
    pub(super) replacement_reasons: BTreeMap<usize, Reason>,
    pub(super) memory: BTreeMap<usize, MemorySchedule>,
    pub(super) slots: Vec<Option<Slot>>,
    pub(super) claims: BTreeMap<u64, usize>,
    pub(super) next_claim: u64,
    pub(super) available: VecDeque<usize>,
    /// Unused indexes have no reservation and never enter ordinary available selection.
    pub(super) free: BTreeSet<usize>,
    pub(super) controls: BTreeMap<usize, Arc<dyn WorkerControl>>,
    pub(super) retired: BTreeSet<usize>,
    pub(super) next_epoch: u64,
    pub(super) epochs: BTreeMap<String, u64>,
    pub(super) bundles: BTreeMap<String, Bundle>,
    pub(super) modules: BTreeMap<String, Arc<Vec<Module>>>,
    pub(super) compiled: BTreeMap<String, Arc<CompiledGeneration>>,
    pub(super) recipes: Recipes,
    pub(super) leases: BTreeMap<String, BTreeSet<u64>>,
    pub(super) maps: BTreeMap<String, CssModules>,
    pub(super) bindings: BTreeMap<String, Arc<Bindings>>,
    pub(super) contexts: BTreeSet<String>,
    pub(super) affinity: BTreeMap<String, Affinity>,
    pub(super) waiting: BTreeMap<u64, Waiting>,
    pub(super) ticket: u64,
    pub(super) serving: u64,
    pub(super) stopped: bool,
}

impl State {
    /// Count retained and pending reservations, including permanently retired indexes.
    pub(super) fn allocated(&self) -> usize {
        self.slots.len() - self.free.len()
    }
}
