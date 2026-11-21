//! Early work keeps one bundle serial and one process-specific render adoption marker.

use std::sync::{Arc, Weak};

use crate::pool_state::State;
use crate::workers::WorkerControl;

#[derive(Clone)]
pub(super) struct Process {
    pub(super) index: usize,
    pub(super) control: Weak<dyn WorkerControl>,
}

impl Process {
    pub(super) fn current(&self, state: &State) -> bool {
        state
            .controls
            .get(&self.index)
            .is_some_and(|control| self.control.ptr_eq(&Arc::downgrade(control)))
    }
}

pub(super) struct Pending {
    pub(super) complete: bool,
    pub(super) visible_description: bool,
    pub(super) serial: u64,
    pub(super) generation: String,
    pub(super) epoch: u64,
    pub(super) bundler: Process,
    pub(super) selected: Option<Process>,
}

pub(super) struct Marker {
    pub(super) serial: u64,
    pub(super) generation: String,
    pub(super) epoch: u64,
    pub(super) process: Process,
    pub(super) started: bool,
    pub(super) ready: bool,
}

#[derive(Default)]
pub(super) struct Early {
    pub(super) enabled: bool,
    pub(super) serial: u64,
    pub(super) context: Option<String>,
    pub(super) pending: Option<Pending>,
    pub(super) marker: Option<Marker>,
    pub(super) active: Option<u64>,
}

impl Early {
    /// Clearing a marker makes every late call unable to count it a second time.
    pub(super) fn abort(&mut self) {
        self.pending = None;
        if self.marker.take().is_some_and(|marker| marker.started) {
            tracing::info!(target: "mokly::early_preparation", aborted = 1_u64);
        }
    }

    pub(super) fn published(&mut self) {
        self.pending = None;
        if self.marker.as_ref().is_some_and(|marker| !marker.ready) {
            self.abort();
        }
    }

    pub(super) fn waiting(&self) -> bool {
        self.pending
            .as_ref()
            .is_some_and(|pending| !pending.complete)
    }
}
