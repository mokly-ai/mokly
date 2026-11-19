//! Idle head processes load a newly described head generation before its renders.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Weak};

use crate::error::Result;
use crate::pool::Pool;
use crate::pool_cleanup::{pending, stale_generation};
use crate::pool_exchange::reusable;
use crate::pool_preparation::Preparation;
use crate::pool_state::{Slot, State};
use crate::workers::WorkerControl;

/// The newest described head generation and the head processes that were live then.
pub(super) struct Preload {
    generation: String,
    /// Each candidate keeps the identity of the process that it had at the describe.
    candidates: BTreeMap<usize, Weak<dyn WorkerControl>>,
}

impl Preload {
    /// Take every other live head process as a candidate, or nothing when none is live.
    pub(super) fn new(
        state: &State,
        generation: &str,
        described: usize,
        head: &Path,
    ) -> Option<Self> {
        let candidates = state
            .source_roots
            .iter()
            .filter(|(index, root)| {
                **index != described && root.as_path() == head && !state.retired.contains(index)
            })
            .filter_map(|(index, _)| {
                state
                    .controls
                    .get(index)
                    .map(|control| (*index, Arc::downgrade(control)))
            })
            .collect::<BTreeMap<_, _>>();
        (!candidates.is_empty()).then(|| Self {
            generation: generation.into(),
            candidates,
        })
    }
}

impl Pool {
    /// Load the missing inputs on one idle candidate, returning whether a process was taken.
    pub(super) fn maintain_preload(&self) -> bool {
        let Some((index, mut slot, generation)) = self.claim_preload() else {
            return false;
        };
        let (slot, ended) = match self.preload(&mut slot, &generation) {
            Ok(ended) => (Some(slot), ended),
            Err(error) => {
                tracing::warn!(%error, slot = index, "sidecar head preload failed");
                if reusable(&error) {
                    (Some(slot), true)
                } else {
                    if let Err(error) = self.replace(index, slot.control.as_ref()) {
                        tracing::warn!(%error, slot = index, "sidecar head preload kill failed");
                    }
                    (None, true)
                }
            }
        };
        let mut state = self.lock();
        state.head.preloading = None;
        if ended && let Some(preload) = &mut state.head.preload {
            preload.candidates.remove(&index);
        }
        self.publish(&mut state, index, slot);
        true
    }

    fn claim_preload(&self) -> Option<(usize, Slot, String)> {
        let mut state = self.lock();
        if state.stopped
            || state.head.active.is_some()
            || state.head.preloading.is_some()
            || !quiet(&state)
        {
            return None;
        }
        let generation = state.head.preload.as_ref()?.generation.clone();
        if !current(&state, &generation) {
            state.head.preload = None;
            return None;
        }
        let head = self.launch.repository.as_path();
        let finished = state
            .head
            .preload
            .as_ref()?
            .candidates
            .iter()
            .filter(|(index, control)| ended(&state, **index, control, &generation, head))
            .map(|(index, _)| *index)
            .collect::<Vec<_>>();
        if let Some(preload) = &mut state.head.preload {
            for index in finished {
                preload.candidates.remove(&index);
            }
        }
        if state
            .head
            .preload
            .as_ref()
            .is_some_and(|preload| preload.candidates.is_empty())
        {
            state.head.preload = None;
            return None;
        }
        let candidates = &state.head.preload.as_ref()?.candidates;
        let (position, index) = state
            .available
            .iter()
            .enumerate()
            .find(|(_, index)| {
                candidates.contains_key(index)
                    && state.slots[**index]
                        .as_ref()
                        .is_some_and(|slot| !pending(&state, slot))
            })
            .map(|(position, index)| (position, *index))?;
        let slot = state.slots[index].take()?;
        state.available.remove(position);
        state.head.preloading = Some(index);
        Some((index, slot, generation))
    }

    /// Send each missing input in its own call; `Ok(true)` means that the process holds them all.
    fn preload(&self, slot: &mut Slot, generation: &str) -> Result<bool> {
        loop {
            let (preparation, describe) = {
                let state = self.lock();
                if !current(&state, generation) || pending(&state, slot) {
                    return Ok(false);
                }
                let Some(step) = next(&state, slot, generation) else {
                    return Ok(true);
                };
                if !quiet(&state) || self.next_return(&state).is_some() {
                    return Ok(false);
                }
                step
            };
            self.restore(slot, generation, describe, preparation)?;
        }
    }
}

/// No request waits in the pool queue, and no call that Serve admitted is still on its way to it.
fn quiet(state: &State) -> bool {
    state.waiting.is_empty() && state.claims.keys().all(|id| state.arrived.contains(id))
}

/// The preload target is still the newest head generation, and the pool retains its inputs.
fn current(state: &State, generation: &str) -> bool {
    !state.stopped
        && !state.head.return_disabled
        && state
            .head
            .preload
            .as_ref()
            .is_some_and(|preload| preload.generation == generation)
        && state.bundles.contains_key(generation)
        && state.compiled.contains_key(generation)
        && state.modules.contains_key(generation)
        && state.epochs.contains_key(generation)
        && state.maps.contains_key(generation)
}

/// A candidate ends when its process left the head root or was replaced, or holds every input.
fn ended(
    state: &State,
    index: usize,
    control: &Weak<dyn WorkerControl>,
    generation: &str,
    head: &Path,
) -> bool {
    state.retired.contains(&index)
        || state
            .source_roots
            .get(&index)
            .is_none_or(|root| root != head)
        || state
            .controls
            .get(&index)
            .is_none_or(|live| !control.ptr_eq(&Arc::downgrade(live)))
        || state
            .slots
            .get(index)
            .and_then(Option::as_ref)
            .is_some_and(|slot| holds(state, slot, generation))
}

/// The slot holds the current lifetime of the generation with its maps and description.
fn holds(state: &State, slot: &Slot, generation: &str) -> bool {
    slot.generations
        .get(generation)
        .is_some_and(|epoch| !stale_generation(state, generation, *epoch))
        && slot.maps.contains(generation)
        && slot.described.contains(generation)
}

/// The one call that a slot without stale state needs next, with whether that call describes.
fn next(state: &State, slot: &Slot, generation: &str) -> Option<(Preparation, bool)> {
    let (maps, describe) = if !slot.generations.contains_key(generation) {
        (false, false)
    } else if !slot.maps.contains(generation) {
        (true, false)
    } else if !slot.described.contains(generation) {
        (false, true)
    } else {
        return None;
    };
    Some((
        Preparation::snapshot(state, slot, generation, maps, false, false),
        describe,
    ))
}

#[cfg(test)]
#[path = "_tests_/head_preload/mod.rs"]
mod head_preload_tests;
