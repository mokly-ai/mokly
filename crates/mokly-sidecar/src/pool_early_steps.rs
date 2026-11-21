//! One early step sends one quiet call and records only the input that returned.

use std::sync::Arc;

use crate::compiled::RestoreGeneration;
use crate::methods::{Call, Generation};
use crate::pool::Pool;
use crate::pool_early_state::{Marker, Process};
use crate::pool_exchange::reusable;
use crate::pool_state::{Slot, State};
use crate::wire::Request;

pub(super) struct Step {
    pub(super) index: usize,
    pub(super) serial: u64,
    pub(super) epoch: u64,
    pub(super) slot: Slot,
    pub(super) call: Call,
}

impl Pool {
    pub(super) fn maintain_early(&self) -> bool {
        let Some(mut step) = self.claim_early() else {
            return false;
        };
        let sent = {
            let mut state = self.lock();
            let live = !state.stopped
                && state.waiting.is_empty()
                && state
                    .claims
                    .keys()
                    .all(|claim| state.running_claims.contains_key(claim))
                && state
                    .head
                    .early
                    .pending
                    .as_ref()
                    .is_some_and(|pending| pending.serial == step.serial);
            if live
                && let Some(marker) = &mut state.head.early.marker
                && !marker.started
            {
                marker.started = true;
                tracing::info!(target: "mokly::early_preparation", started = 1_u64);
            }
            live
        };
        let mut kept = true;
        if sent {
            let deadline = self
                .options
                .timeout_ms
                .unwrap_or_else(|| step.call.timeout_ms());
            let request = Request {
                id: 1,
                call: step.call,
                quiet: true,
            };
            match step.slot.worker.request(&request, deadline) {
                Ok(_) => {
                    installed(&mut step.slot, &request.call, step.epoch);
                    let mut state = self.lock();
                    if let Some(marker) = &mut state.head.early.marker
                        && marker.serial == step.serial
                        && matches!(request.call, Call::Describe(_))
                    {
                        marker.ready = true;
                    }
                    if matches!(request.call, Call::Describe(_))
                        && let Some(pending) = &mut state.head.early.pending
                        && pending.serial == step.serial
                    {
                        pending.complete = true;
                    }
                }
                Err(error) => {
                    {
                        let mut state = self.lock();
                        if state.head.early.serial == step.serial {
                            state.head.early.abort();
                        }
                    }
                    if !reusable(&error) {
                        let _ = self.replace(step.index, step.slot.control.as_ref());
                        kept = false;
                    }
                }
            }
        }
        {
            let mut state = self.lock();
            if state.head.early.active == Some(step.serial) {
                state.head.early.active = None;
            }
        }
        self.release(step.index, kept.then_some(step.slot), None);
        sent
    }
}

/// Every older loaded generation leaves before the new recipe is restored.
pub(super) fn next(state: &State, slot: &Slot, generation: &str, epoch: u64) -> Option<Call> {
    if let Some((id, _)) = slot
        .generations
        .iter()
        .find(|(id, loaded)| id.as_str() != generation || **loaded != epoch)
    {
        return Some(Call::Dispose(Generation {
            generation: id.clone(),
        }));
    }
    if slot.generations.get(generation) != Some(&epoch) {
        return Some(Call::RestoreGeneration(Box::new(RestoreGeneration {
            generation: generation.into(),
            params: state.bundles.get(generation)?.clone(),
            modules: state.modules.get(generation)?.clone(),
            compiled: state.compiled.get(generation)?.clone(),
        })));
    }
    if state.map_epochs.get(generation) != Some(&epoch) {
        return None;
    }
    if !slot.maps.contains(generation) {
        return Some(Call::CssModules(state.maps.get(generation)?.clone()));
    }
    if !state
        .head
        .early
        .pending
        .as_ref()
        .is_some_and(|pending| pending.visible_description)
    {
        return None;
    }
    (!slot.described.contains(generation)).then(|| {
        Call::Describe(Generation {
            generation: generation.into(),
        })
    })
}

pub(super) fn marker(
    index: usize,
    serial: u64,
    generation: String,
    epoch: u64,
    slot: &Slot,
) -> Marker {
    Marker {
        serial,
        generation,
        epoch,
        process: Process {
            index,
            control: Arc::downgrade(&slot.control),
        },
        started: false,
        ready: false,
    }
}

fn installed(slot: &mut Slot, call: &Call, epoch: u64) {
    match call {
        Call::RestoreGeneration(recipe) => {
            slot.generations.insert(recipe.generation.clone(), epoch);
        }
        Call::CssModules(maps) => {
            slot.maps.insert(maps.generation.clone());
        }
        Call::Describe(generation) => {
            slot.described.insert(generation.generation.clone());
        }
        Call::Dispose(generation) => {
            slot.generations.remove(&generation.generation);
            slot.maps.remove(&generation.generation);
            slot.described.remove(&generation.generation);
            slot.bindings.remove(&generation.generation);
        }
        _ => {}
    }
}
