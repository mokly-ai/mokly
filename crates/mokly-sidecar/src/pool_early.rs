//! An existing idle other head process yields before each optional preparation call.

use std::sync::Arc;

use crate::pool::Pool;
use crate::pool_early_state::Process;
use crate::pool_early_steps::{self, Step};

impl Pool {
    pub(super) fn claim_early(&self) -> Option<Step> {
        let mut state = self.lock();
        if state.stopped
            || state.head.return_disabled
            || state.head.early.active.is_some()
            || !state.waiting.is_empty()
            || state
                .claims
                .keys()
                .any(|claim| !state.running_claims.contains_key(claim))
        {
            return None;
        }
        let pending = state.head.early.pending.as_ref()?;
        if pending.complete {
            return None;
        }
        if state.epochs.get(&pending.generation) != Some(&pending.epoch)
            || !pending.bundler.current(&state)
        {
            state.head.early.abort();
            return None;
        }
        let serial = pending.serial;
        let generation = pending.generation.clone();
        let epoch = pending.epoch;
        let selected = pending.selected.clone();
        let bundler = pending.bundler.index;
        if selected
            .as_ref()
            .is_some_and(|process| !process.current(&state))
        {
            state.head.early.abort();
            return None;
        }
        let (position, index) =
            state
                .available
                .iter()
                .enumerate()
                .find_map(|(position, index)| {
                    let slot = state.slots[*index].as_ref()?;
                    let excluded = state.head.early.context.as_ref().is_some_and(|context| {
                        state.contexts.contains(context) && slot.contexts.contains(context)
                    });
                    (slot.source_root == self.launch.repository
                        && *index != bundler
                        && !excluded
                        && selected
                            .as_ref()
                            .is_none_or(|process| process.index == *index))
                    .then_some((position, *index))
                })?;
        let slot = state.slots[index].as_ref()?;
        let call = pool_early_steps::next(&state, slot, &generation, epoch)?;
        let process = Process {
            index,
            control: Arc::downgrade(&slot.control),
        };
        let marker = pool_early_steps::marker(index, serial, generation, epoch, slot);
        if let Some(pending) = &mut state.head.early.pending {
            pending.selected = Some(process);
        }
        if state.head.early.marker.is_none() {
            state.head.early.marker = Some(marker);
        }
        let slot = state.slots[index].take()?;
        state.available.remove(position);
        state.head.early.active = Some(serial);
        Some(Step {
            index,
            serial,
            epoch,
            slot,
            call,
        })
    }
}
