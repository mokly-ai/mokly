//! Cold head processes prepare and replay the newest head generation while the pool is idle.

use std::collections::BTreeMap;
use std::sync::Arc;

use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_cleanup::{pending, stale_generation};
use crate::pool_exchange::reusable;
use crate::pool_preparation::{Preparation, Prerequisites};
use crate::pool_recycle::RENDER_LIMIT;
use crate::pool_requests::generation;
use crate::pool_state::{Slot, State};
use crate::wire::MethodResult;

/// The next action of a warm-up step.
enum Step {
    /// Send the one render input that the process lacks, with whether it is `describe`.
    Prepare(Box<Preparation>, String, bool),
    /// Send one recorded render call and discard its result.
    Replay(Arc<Call>),
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
                    self.restore(&mut slot, &generation, describe, *preparation, true)
                }
                Step::Replay(call) => {
                    slot.renders += 1;
                    let outcome = self.prerequisite(&mut slot, (*call).clone(), true);
                    if outcome
                        .as_ref()
                        .is_ok_and(MethodResult::is_successful_render)
                    {
                        let mut state = self.lock();
                        if let Some(epoch) = state
                            .head
                            .warm
                            .as_ref()
                            .filter(|warm| generation(&call) == Some(warm.generation.as_str()))
                            .and_then(|warm| state.epochs.get(&warm.generation))
                            .copied()
                            .filter(|epoch| {
                                generation(&call).and_then(|id| slot.generations.get(id))
                                    == Some(epoch)
                            })
                        {
                            state.head.warmups.rendered(
                                index,
                                Arc::downgrade(&slot.control),
                                epoch,
                            );
                        }
                    }
                    outcome.map(|_| ())
                }
            };
            sent = true;
            if let Err(error) = outcome {
                if !error.fresh_worker_required() {
                    tracing::warn!(%error, slot = index, "sidecar warm-up failed");
                }
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
        return Step::Prepare(Box::new(preparation), generation, describe);
    }
    if slot.renders >= RENDER_LIMIT - 1 {
        return Step::End;
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
