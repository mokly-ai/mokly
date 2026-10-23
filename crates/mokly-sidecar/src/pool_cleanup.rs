//! Dispose stale loaded state before a worker takes another request.

use std::sync::{Mutex, MutexGuard};

use crate::bindings::DisposeContext;
use crate::error::{InternalError, Result};
use crate::methods::{Call, Generation};
use crate::pool_state::{Slot, State};
use crate::wire::Request;

pub(super) fn lock(state: &Mutex<State>) -> Result<MutexGuard<'_, State>> {
    match state.lock() {
        Ok(state) => Ok(state),
        Err(_) => Err(InternalError::Synchronization.into()),
    }
}

pub(super) fn pending(state: &State, slot: &Slot) -> bool {
    slot.generations
        .iter()
        .any(|(id, epoch)| stale_generation(state, id, *epoch))
        || !slot.contexts.is_subset(&state.contexts)
}

fn stale_generation(state: &State, id: &str, epoch: u64) -> bool {
    !state.bundles.contains_key(id) || state.epochs.get(id) != Some(&epoch)
}

pub(super) fn cleanup(state: &Mutex<State>, slot: &mut Slot, timeout: Option<u64>) -> Result<bool> {
    if lock(state)?.stopped {
        return Ok(false);
    }
    let stale = {
        let state = lock(state)?;
        slot.generations
            .iter()
            .filter(|(id, epoch)| stale_generation(&state, id, **epoch))
            .map(|(id, _)| id.clone())
            .collect::<Vec<_>>()
    };
    let mut changed = !stale.is_empty();
    for generation in stale {
        slot.worker.request(
            &Request {
                id: 1,
                call: Call::Dispose(Generation {
                    generation: generation.clone(),
                }),
            },
            timeout.unwrap_or(30_000),
        )?;
        slot.generations.remove(&generation);
        slot.maps.remove(&generation);
        slot.described.remove(&generation);
        slot.bindings.remove(&generation);
    }
    let stale_contexts = {
        let state = lock(state)?;
        slot.contexts
            .difference(&state.contexts)
            .cloned()
            .collect::<Vec<_>>()
    };
    changed |= !stale_contexts.is_empty();
    for context in stale_contexts {
        slot.worker.request(
            &Request {
                id: 1,
                call: Call::DisposeContext(DisposeContext {
                    context: context.clone(),
                }),
            },
            timeout.unwrap_or(30_000),
        )?;
        slot.contexts.remove(&context);
    }
    Ok(changed)
}

#[cfg(test)]
#[path = "_tests_/pool_cleanup_tests.rs"]
mod pool_cleanup_tests;
