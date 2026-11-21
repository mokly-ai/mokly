//! Visible normal evaluation starts before any speculative quiet evaluation.

use std::sync::Arc;

use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_state::Slot;

impl Pool {
    pub(super) fn start_visible_description(&self, index: usize, slot: &Slot, call: &Call) {
        let Call::Describe(generation) = call else {
            return;
        };
        let mut state = self.lock();
        let visible = !state.stopped
            && state.head.early.pending.as_ref().is_some_and(|pending| {
                pending.generation == generation.generation
                    && pending.bundler.index == index
                    && pending.bundler.current(&state)
                    && pending
                        .bundler
                        .control
                        .ptr_eq(&Arc::downgrade(&slot.control))
                    && state.epochs.get(&pending.generation) == Some(&pending.epoch)
                    && slot.generations.get(&pending.generation) == Some(&pending.epoch)
            });
        if visible {
            if let Some(pending) = &mut state.head.early.pending {
                pending.visible_description = true;
            }
            state.head.notify();
        }
    }

    /// Normal routing may evaluate the selected process first, without a quiet call.
    pub(super) fn complete_visible_description(&self, index: usize, slot: &Slot, call: &Call) {
        let Call::Describe(generation) = call else {
            return;
        };
        let mut state = self.lock();
        let complete = !state.stopped
            && state.head.early.pending.as_ref().is_some_and(|pending| {
                pending.generation == generation.generation
                    && pending.bundler.index != index
                    && pending.selected.as_ref().is_none_or(|selected| {
                        selected.index == index
                            && selected.control.ptr_eq(&Arc::downgrade(&slot.control))
                    })
                    && slot.source_root == self.launch.repository
                    && state.epochs.get(&pending.generation) == Some(&pending.epoch)
                    && state.map_epochs.get(&pending.generation) == Some(&pending.epoch)
                    && slot.generations.get(&pending.generation) == Some(&pending.epoch)
                    && slot.maps.contains(&pending.generation)
                    && slot.described.contains(&pending.generation)
            });
        if complete {
            if let Some(pending) = &mut state.head.early.pending {
                pending.complete = true;
            }
            if let Some(marker) = &mut state.head.early.marker
                && marker.process.index == index
                && marker
                    .process
                    .control
                    .ptr_eq(&Arc::downgrade(&slot.control))
            {
                marker.ready = true;
            }
        }
    }
}
