//! The latest successful head generation identifies one useful process.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Weak};

use crate::methods::Call;
use crate::pool::{Pool, ReturnWake};
use crate::pool_preload::Preload;
use crate::pool_requests::generation;
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
    /// The described newest head generation that idle head processes still lack.
    pub(super) preload: Option<Preload>,
    /// The slot whose process a preload step holds.
    pub(super) preloading: Option<usize>,
}

impl Head {
    /// The wake records work only; it never runs maintenance under the state lock.
    pub(super) fn notify(&self) {
        if (!self.candidates.is_empty() || self.preload.is_some())
            && let Some(wake) = self.wake.as_ref().and_then(Weak::upgrade)
        {
            wake.notify();
        }
    }
}

impl Pool {
    pub(super) fn record_head(&self, index: usize, call: &Call, result: &MethodResult) {
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
                state.head.warm = Some(WarmHead {
                    generation: result.generation.clone(),
                    index,
                    control,
                });
                state.head.preload = None;
            }
            (Call::Describe(described), _)
                if state
                    .head
                    .warm
                    .as_ref()
                    .is_some_and(|warm| warm.generation == described.generation)
                    && !state.head.return_disabled
                    && state.source_roots.get(&index) == Some(&self.launch.repository) =>
            {
                state.head.preload = Preload::new(
                    &state,
                    &described.generation,
                    index,
                    &self.launch.repository,
                );
                state.head.notify();
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
                    warm.control = control;
                }
            }
            _ => {}
        }
    }
}
