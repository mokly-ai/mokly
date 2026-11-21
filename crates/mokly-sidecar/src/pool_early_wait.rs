//! Older head requests exclude the selected process only during the early window.

use std::path::Path;

use crate::pool_state::State;
use crate::workers::Clock;

pub(super) fn allowed(state: &State, index: usize, root: &Path, generation: Option<&str>) -> bool {
    let Some((pending, generation)) = state.head.early.pending.as_ref().zip(generation) else {
        return true;
    };
    !pending.selected.as_ref().is_some_and(|selected| {
        selected.index == index
            && selected.current(state)
            && state
                .source_roots
                .get(&index)
                .is_some_and(|source| source == root)
            && state
                .epochs
                .get(generation)
                .is_some_and(|epoch| *epoch < pending.epoch)
    })
}

#[derive(Default)]
pub(super) struct PublishedWait {
    started: Option<u64>,
    counted: bool,
}

impl PublishedWait {
    /// Each transition records only the part that the generation exclusion caused.
    pub(super) fn update(&mut self, clock: &dyn Clock, forced: bool) {
        match (self.started, forced) {
            (None, true) => {
                self.started = Some(clock.now_ms());
                if !self.counted {
                    self.counted = true;
                    tracing::info!(target: "mokly::early_preparation", published_waits = 1_u64);
                }
            }
            (Some(started), false) => {
                self.started = None;
                let elapsed = clock.now_ms().saturating_sub(started);
                tracing::info!(target: "mokly::early_preparation", published_wait_ms = elapsed);
            }
            _ => {}
        }
    }
}
