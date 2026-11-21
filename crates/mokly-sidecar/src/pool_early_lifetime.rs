//! Bundle boundaries and adopted snapshots fence every speculative lifetime.

use std::path::Path;
use std::sync::Arc;

use crate::error::Result;
use crate::methods::{BundleCapture, Call};
use crate::pool::Pool;
use crate::pool_early_state::{Pending, Process};
use crate::pool_requests::generation;
use crate::pool_state::Slot;
use crate::wire::MethodResult;

impl Pool {
    pub(super) fn begin_early_attempt(&self, context: &str) {
        self.lock().head.early.context = Some(context.into());
    }

    pub(super) fn end_early_attempt(&self) {
        self.lock().head.early.abort();
        self.ready.notify_all();
    }

    pub(super) fn publish_head(&self) {
        self.lock().head.early.published();
        self.ready.notify_all();
    }

    /// Begin before acquisition, including bundles that fail before a response exists.
    pub(super) fn begin_head_bundle(&self, call: &Call) -> Option<u64> {
        let Call::Bundle(bundle) = call else {
            return None;
        };
        if Path::new(&bundle.params.source_root) != self.launch.repository {
            return None;
        }
        let mut state = self.lock();
        state.head.early.abort();
        state.head.early.serial += 1;
        self.ready.notify_all();
        Some(state.head.early.serial)
    }

    pub(super) fn end_head_bundle(&self, serial: Option<u64>, outcome: &Result<MethodResult>) {
        if outcome.is_err() {
            let mut state = self.lock();
            if serial == Some(state.head.early.serial) {
                state.head.early.abort();
                self.ready.notify_all();
            }
        }
    }

    pub(super) fn record_early_bundle(
        &self,
        serial: Option<u64>,
        index: usize,
        slot: &Slot,
        call: &Call,
        result: &MethodResult,
    ) {
        let (Call::Bundle(request), MethodResult::Bundle(bundle), Some(serial)) =
            (call, result, serial)
        else {
            return;
        };
        let mut state = self.lock();
        if !state.stopped
            && !state.head.return_disabled
            && state.head.early.enabled
            && state.head.early.serial == serial
            && request.capture == Some(BundleCapture::ServeEdit)
            && state.epochs.get(&bundle.generation) == Some(&bundle.epoch)
        {
            state.head.early.pending = Some(Pending {
                complete: false,
                visible_description: false,
                serial,
                generation: bundle.generation.clone(),
                epoch: bundle.epoch,
                bundler: Process {
                    index,
                    control: Arc::downgrade(&slot.control),
                },
                selected: None,
            });
            state.head.notify();
        }
    }

    /// Adoption belongs to the attempted real render, before its body can fail.
    pub(super) fn adopt_early(&self, index: usize, slot: &Slot, call: &Call) {
        let mut state = self.lock();
        let adopted = !state.stopped
            && state.head.early.marker.as_ref().is_some_and(|marker| {
                marker.started
                    && marker.ready
                    && marker.process.index == index
                    && marker
                        .process
                        .control
                        .ptr_eq(&Arc::downgrade(&slot.control))
                    && generation(call) == Some(marker.generation.as_str())
                    && slot.generations.get(&marker.generation) == Some(&marker.epoch)
                    && state.epochs.get(&marker.generation) == Some(&marker.epoch)
            });
        if adopted {
            state.head.early.marker = None;
            tracing::info!(target: "mokly::early_preparation", adopted = 1_u64);
        }
    }

    pub(super) fn discard_early_process(&self, index: usize) {
        let mut state = self.lock();
        if state
            .head
            .early
            .marker
            .as_ref()
            .is_some_and(|marker| marker.process.index == index)
        {
            state.head.early.abort();
        }
    }
}
