//! The latest successful head generation identifies one useful process.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Weak};

use crate::methods::Call;
use crate::pool::{Pool, ReturnWake};
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
    pub(super) available_wake: Option<Weak<dyn ReturnWake>>,
}

impl Head {
    /// The wake records work only; it never runs maintenance under the state lock.
    pub(super) fn notify(&self) {
        if let Some(wake) = self.available_wake.as_ref().and_then(Weak::upgrade) {
            wake.notify();
        }
        if !self.candidates.is_empty()
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
