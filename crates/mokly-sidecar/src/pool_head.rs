//! The latest successful head generation identifies one useful process.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Weak};

use crate::methods::Call;
use crate::pool::{Pool, ReturnWake};
use crate::pool_requests::generation;
use crate::pool_state::Slot;
use crate::pool_warmup_state::Warmups;
use crate::wire::MethodResult;
use crate::workers::WorkerControl;

pub(super) struct WarmHead {
    pub(super) generation: String,
    pub(super) index: usize,
    pub(super) control: Weak<dyn WorkerControl>,
}

#[derive(Default)]
pub(super) struct Head {
    pub(super) warm: Option<WarmHead>,
    pub(super) pass: u64,
    pub(super) candidates: BTreeMap<usize, u64>,
    pub(super) active: Option<usize>,
    pub(super) return_disabled: bool,
    pub(super) wake: Option<Weak<dyn ReturnWake>>,
    /// Recent render calls of the newest head generation and the pending warm-ups.
    pub(super) warmups: Warmups,
}

impl Head {
    /// The wake records work only; it never runs maintenance under the state lock.
    pub(super) fn notify(&self) {
        if (!self.candidates.is_empty() || self.warmups.waiting())
            && let Some(wake) = self.wake.as_ref().and_then(Weak::upgrade)
        {
            wake.notify();
        }
    }
}

impl Pool {
    pub(super) fn record_head(
        &self,
        index: usize,
        slot: &Slot,
        call: &Call,
        result: &MethodResult,
    ) {
        let mut state = self.lock();
        if state.stopped {
            return;
        }
        let Some(control) = state.controls.get(&index).map(Arc::downgrade) else {
            return;
        };
        match (call, result) {
            (Call::Bundle(bundle), MethodResult::Bundle(result))
                if Path::new(&bundle.params.source_root) == self.launch.repository =>
            {
                if state
                    .head
                    .warm
                    .as_ref()
                    .is_none_or(|warm| warm.generation != result.generation)
                {
                    state.head.warmups.reset();
                }
                state.head.warm = Some(WarmHead {
                    generation: result.generation.clone(),
                    index,
                    control,
                });
            }
            (
                Call::RenderScreen(_)
                | Call::RenderComponent(_)
                | Call::RenderStory(_)
                | Call::RenderPage(_),
                _,
            ) if state
                .head
                .warm
                .as_ref()
                .is_some_and(|warm| generation(call) == Some(warm.generation.as_str()))
                && state.source_roots.get(&index) == Some(&self.launch.repository) =>
            {
                if let Some(warm) = &mut state.head.warm {
                    warm.index = index;
                    warm.control = control.clone();
                }
                if let Some(epoch) = generation(call)
                    .and_then(|id| {
                        slot.generations
                            .get(id)
                            .filter(|epoch| state.epochs.get(id) == Some(*epoch))
                    })
                    .copied()
                {
                    state.head.warmups.rendered(index, control, epoch);
                }
                state.head.warmups.record(call);
            }
            _ => {}
        }
    }

    pub(super) fn record_stored_render(&self, source_root: &Path, call: Call) {
        let mut state = self.lock();
        if !state.stopped
            && source_root == self.launch.repository
            && matches!(
                call,
                Call::RenderScreen(_)
                    | Call::RenderComponent(_)
                    | Call::RenderStory(_)
                    | Call::RenderPage(_)
            )
            && state.head.warm.as_ref().is_some_and(|warm| {
                generation(&call) == Some(warm.generation.as_str())
                    && state.epochs.contains_key(&warm.generation)
            })
        {
            state.head.warmups.record_served(call);
            state.head.notify();
        }
    }
}
