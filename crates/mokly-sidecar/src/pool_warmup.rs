//! A process that the return pass starts prepares and replays the newest head generation while
//! the pool is idle.

use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Weak};

use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_cleanup::{pending, stale_generation};
use crate::pool_exchange::reusable;
use crate::pool_preparation::{Preparation, Prerequisites};
use crate::pool_state::{Slot, State};
use crate::workers::WorkerControl;

/// The bound of the recorded head render calls, and so of the replays of one warm-up.
const REPLAYS: usize = 30;

/// Recent head render calls and the processes of the return pass that still warm up.
#[derive(Default)]
pub(super) struct Warmups {
    /// Successful render calls of the newest head generation, oldest first.
    recent: VecDeque<Call>,
    /// The warm-up of each slot, keyed by the slot index.
    pending: BTreeMap<usize, Warmup>,
    /// The serial of the warm-up whose step holds its process.
    active: Option<u64>,
    /// The serial of the newest warm-up.
    serial: u64,
}

/// One process that the return pass started, and its replay progress.
struct Warmup {
    serial: u64,
    /// Another process in the slot ends the warm-up.
    control: Weak<dyn WorkerControl>,
    /// The calls still to replay, copied when the preparation first completes.
    replays: Option<VecDeque<Call>>,
}

impl Warmups {
    /// Keep one successful render call of the newest head generation.
    pub(super) fn record(&mut self, call: &Call) {
        if self.recent.len() == REPLAYS {
            self.recent.pop_front();
        }
        self.recent.push_back(call.clone());
    }

    /// A newer head generation or disabled background return ends every warm-up.
    pub(super) fn reset(&mut self) {
        self.recent.clear();
        self.pending.clear();
    }

    /// Warm up a process that the return pass started in this slot.
    pub(super) fn start(&mut self, index: usize, control: &Arc<dyn WorkerControl>) {
        self.serial += 1;
        self.pending.insert(
            index,
            Warmup {
                serial: self.serial,
                control: Arc::downgrade(control),
                replays: None,
            },
        );
    }

    /// Some process still waits for its warm-up.
    pub(super) fn waiting(&self) -> bool {
        !self.pending.is_empty()
    }

    fn holds(&self, index: usize, serial: u64) -> bool {
        self.pending
            .get(&index)
            .is_some_and(|warmup| warmup.serial == serial)
    }

    fn replay(&mut self, index: usize) -> Option<Call> {
        let recent = &self.recent;
        let warmup = self.pending.get_mut(&index)?;
        warmup
            .replays
            .get_or_insert_with(|| recent.clone())
            .pop_front()
    }

    /// A late outcome changes only its own warm-up.
    fn close(&mut self, index: usize, serial: u64, ended: bool) {
        if self.active == Some(serial) {
            self.active = None;
        }
        if ended && self.holds(index, serial) {
            self.pending.remove(&index);
        }
    }
}

/// The next action of a warm-up step.
enum Step {
    /// Send the one render input that the process lacks, with whether it is `describe`.
    Prepare(Preparation, String, bool),
    /// Send one recorded render call and discard its result.
    Replay(Call),
    /// Give the process back and continue later.
    Pause,
    /// Give the process back and end its warm-up.
    End,
}

impl Pool {
    /// Warm up one idle process, returning whether a call was sent or a warm-up ended.
    pub(super) fn maintain_warmup(&self) -> bool {
        let Some((index, serial, mut slot)) = self.claim_warmup() else {
            return false;
        };
        let mut sent = false;
        let (ended, kept) = loop {
            let step = next(&mut self.lock(), index, serial, &slot);
            let outcome = match step {
                Step::Pause => break (false, true),
                Step::End => break (true, true),
                Step::Prepare(preparation, generation, describe) => {
                    self.restore(&mut slot, &generation, describe, preparation)
                }
                Step::Replay(call) => {
                    slot.renders += 1;
                    self.prerequisite(&mut slot, call)
                }
            };
            sent = true;
            if let Err(error) = outcome {
                tracing::warn!(%error, slot = index, "sidecar warm-up failed");
                if reusable(&error) {
                    break (true, true);
                }
                if let Err(error) = self.replace(index, slot.control.as_ref()) {
                    tracing::warn!(%error, slot = index, "sidecar warm-up kill failed");
                }
                break (true, false);
            }
        };
        self.lock().head.warmups.close(index, serial, ended);
        self.release(index, kept.then_some(slot), None);
        sent || ended
    }

    fn claim_warmup(&self) -> Option<(usize, u64, Slot)> {
        let mut state = self.lock();
        if state.stopped
            || state.head.return_disabled
            || state.head.warmups.active.is_some()
            || !idle(&state)
        {
            return None;
        }
        let live = state
            .head
            .warmups
            .pending
            .iter()
            .filter(|(index, warmup)| {
                !state.retired.contains(*index)
                    && state.source_roots.get(*index) == Some(&self.launch.repository)
                    && state
                        .controls
                        .get(*index)
                        .is_some_and(|control| warmup.control.ptr_eq(&Arc::downgrade(control)))
            })
            .map(|(index, warmup)| (*index, warmup.serial))
            .collect::<BTreeMap<_, _>>();
        state
            .head
            .warmups
            .pending
            .retain(|index, _| live.contains_key(index));
        let (position, index, serial) =
            state
                .available
                .iter()
                .enumerate()
                .find_map(|(position, index)| {
                    let serial = live.get(index)?;
                    state.slots[*index]
                        .as_ref()
                        .filter(|slot| !pending(&state, slot))?;
                    Some((position, *index, *serial))
                })?;
        let slot = state.slots[index].take()?;
        state.available.remove(position);
        state.head.warmups.active = Some(serial);
        Some((index, serial, slot))
    }
}

/// End and pause conditions come before the next call; the slot holds the claimed process.
fn next(state: &mut State, index: usize, serial: u64, slot: &Slot) -> Step {
    let generation = state.head.warm.as_ref().map(|warm| warm.generation.clone());
    let Some(generation) = generation.filter(|generation| {
        !state.stopped
            && !state.head.return_disabled
            && state.head.warmups.holds(index, serial)
            && retained(state, generation)
            && !slot
                .generations
                .iter()
                .any(|(id, epoch)| id != generation && !stale_generation(state, id, *epoch))
    }) else {
        return Step::End;
    };
    if !idle(state) || pending(state, slot) {
        return Step::Pause;
    }
    if let Some((preparation, describe)) = preparation(state, slot, &generation) {
        return Step::Prepare(preparation, generation, describe);
    }
    state
        .head
        .warmups
        .replay(index)
        .map_or(Step::End, Step::Replay)
}

/// No request waits in the pool queue, and Serve holds no admitted call.
fn idle(state: &State) -> bool {
    state.waiting.is_empty() && state.claims.is_empty()
}

/// The pool still retains every input that a render of the generation needs.
fn retained(state: &State, generation: &str) -> bool {
    state.bundles.contains_key(generation)
        && state.compiled.contains_key(generation)
        && state.modules.contains_key(generation)
        && state.epochs.contains_key(generation)
        && state.maps.contains_key(generation)
        && state.bindings.contains_key(generation)
}

/// The restore, class maps, description, or bindings that the slot needs next, in that order.
fn preparation(state: &State, slot: &Slot, generation: &str) -> Option<(Preparation, bool)> {
    let render = Prerequisites {
        maps: true,
        description: true,
        bindings: true,
    };
    let restored = slot.generations.contains_key(generation);
    if restored && render.loaded(state, slot, generation) {
        return None;
    }
    let mapped = slot.maps.contains(generation);
    let described = slot.described.contains(generation);
    let maps = restored && !mapped;
    let bindings = restored && mapped && described;
    let preparation = Preparation::snapshot(state, slot, generation, maps, bindings, bindings);
    Some((preparation, restored && mapped && !described))
}

#[cfg(test)]
#[path = "_tests_/return_warmup/mod.rs"]
mod return_warmup_tests;
