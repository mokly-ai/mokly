//! Shared immutable recent calls and process-specific warm-up progress.

use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Weak};

use crate::methods::Call;
use crate::pool_render_equality::same_render;
use crate::workers::WorkerControl;

const REPLAYS: usize = 30;

struct Recent {
    call: Arc<Call>,
    stored: bool,
}

/// One newest generation's bounded calls, process proofs, and warm-up attempts.
#[derive(Default)]
pub(super) struct Warmups {
    recent: VecDeque<Recent>,
    pub(super) pending: BTreeMap<usize, Warmup>,
    pub(super) active: Option<u64>,
    serial: u64,
    attempted: BTreeMap<usize, (Weak<dyn WorkerControl>, u64)>,
    rendered: BTreeMap<usize, (Weak<dyn WorkerControl>, u64)>,
}

pub(super) struct Warmup {
    pub(super) serial: u64,
    pub(super) control: Weak<dyn WorkerControl>,
    replays: Option<VecDeque<Arc<Call>>>,
}

impl Warmups {
    /// Normal successful renders retain their original order and duplicates.
    pub(super) fn record(&mut self, call: &Call) {
        self.push(Recent {
            call: Arc::new(call.clone()),
            stored: false,
        });
    }

    /// Equal store contributions already in the bounded window add no copy.
    pub(super) fn record_served(&mut self, call: Call) {
        if !self
            .recent
            .iter()
            .any(|recent| recent.stored && same_render(&recent.call, &call))
        {
            self.push(Recent {
                call: Arc::new(call),
                stored: true,
            });
        }
    }

    fn push(&mut self, recent: Recent) {
        if self.recent.len() == REPLAYS {
            self.recent.pop_front();
        }
        self.recent.push_back(recent);
    }

    /// A newer generation clears calls and proofs, without releasing an active process.
    pub(super) fn reset(&mut self) {
        self.recent.clear();
        self.pending.clear();
        self.attempted.clear();
        self.rendered.clear();
    }

    /// Give a process at most one attempt for this epoch, preserving paused progress.
    pub(super) fn start(&mut self, index: usize, control: &Arc<dyn WorkerControl>, epoch: u64) {
        let control = Arc::downgrade(control);
        if self
            .attempted
            .get(&index)
            .is_some_and(|(previous, attempted)| *attempted == epoch && previous.ptr_eq(&control))
        {
            return;
        }
        self.serial += 1;
        self.attempted.insert(index, (control.clone(), epoch));
        self.pending.insert(
            index,
            Warmup {
                serial: self.serial,
                control,
                replays: None,
            },
        );
    }

    /// A completed render proves work only for this process and loaded epoch.
    pub(super) fn rendered(&mut self, index: usize, control: Weak<dyn WorkerControl>, epoch: u64) {
        self.rendered.insert(index, (control, epoch));
    }

    /// Loading or recording a generation never proves that the process rendered it.
    pub(super) fn needs_render(
        &self,
        index: usize,
        control: &Arc<dyn WorkerControl>,
        epoch: u64,
    ) -> bool {
        !self.rendered.get(&index).is_some_and(|(previous, loaded)| {
            *loaded == epoch && previous.ptr_eq(&Arc::downgrade(control))
        })
    }

    pub(super) fn waiting(&self) -> bool {
        !self.pending.is_empty()
    }

    pub(super) fn holds(&self, index: usize, serial: u64) -> bool {
        self.pending
            .get(&index)
            .is_some_and(|warmup| warmup.serial == serial)
    }

    pub(super) fn replay(&mut self, index: usize) -> Option<Arc<Call>> {
        let recent = &self.recent;
        self.pending
            .get_mut(&index)?
            .replays
            .get_or_insert_with(|| recent.iter().map(|recent| recent.call.clone()).collect())
            .pop_front()
    }

    /// A late outcome changes only its own attempt.
    pub(super) fn close(&mut self, index: usize, serial: u64, ended: bool) {
        if self.active == Some(serial) {
            self.active = None;
        }
        if ended && self.holds(index, serial) {
            self.pending.remove(&index);
        }
    }
}
