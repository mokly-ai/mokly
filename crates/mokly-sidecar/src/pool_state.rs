//! FIFO process leasing and generation replay state.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::Arc;

use crate::bindings::Bindings;
use crate::methods::{Bundle, CssModules};
use crate::workers::{Worker, WorkerControl};

pub(super) struct Slot {
    pub(super) worker: Box<dyn Worker>,
    pub(super) control: Arc<dyn WorkerControl>,
    pub(super) generations: BTreeMap<String, u64>,
    pub(super) maps: BTreeSet<String>,
    pub(super) described: BTreeSet<String>,
    pub(super) bindings: BTreeMap<String, Bindings>,
    pub(super) contexts: BTreeSet<String>,
    pub(super) renders: u64,
}

#[derive(Default)]
pub(super) struct State {
    pub(super) slots: Vec<Option<Slot>>,
    pub(super) available: VecDeque<usize>,
    pub(super) controls: BTreeMap<usize, Arc<dyn WorkerControl>>,
    pub(super) next_epoch: u64,
    pub(super) epochs: BTreeMap<String, u64>,
    pub(super) bundles: BTreeMap<String, Bundle>,
    pub(super) maps: BTreeMap<String, CssModules>,
    pub(super) bindings: BTreeMap<String, Bindings>,
    pub(super) contexts: BTreeSet<String>,
    pub(super) ticket: u64,
    pub(super) serving: u64,
    pub(super) stopped: bool,
}
