//! A process never evaluates two source roots under one working directory.

use std::path::{Path, PathBuf};

use crate::error::Result;
use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_requests::generation;
use crate::pool_state::Slot;
use crate::pool_timing::Reason;

impl Pool {
    pub(super) fn source_root(&self, call: &Call) -> Option<PathBuf> {
        let state = self.lock();
        let source = match call {
            Call::Bundle(params) => Some(params.source_root.clone()),
            Call::RestoreGeneration(params) => Some(params.params.source_root.clone()),
            Call::ProcessCss(params) => Some(params.source_root.clone()),
            _ => generation(call).map(|id| state.bundles[id].source_root.clone()),
        };
        source.map(PathBuf::from)
    }

    pub(super) fn isolate(
        &self,
        index: usize,
        slot: &mut Option<Slot>,
        root: Option<&Path>,
    ) -> Result<()> {
        if let (Some(current), Some(root)) = (slot.as_ref(), root)
            && root != current.source_root
        {
            if self.lock().stopped {
                current.control.kill()?;
            } else {
                Reason::RootSwitch.kill(current.control.as_ref())?;
            }
            self.lock()
                .replacement_reasons
                .insert(index, Reason::RootSwitch);
            tracing::debug!(slot = index, previous_root = %current.source_root.display(), source_root = %root.display(), "sidecar source root replaced");
            *slot = None;
            self.forget_other_roots(index, root);
        }
        Ok(())
    }

    pub(super) fn forget_other_roots(&self, index: usize, root: &Path) {
        self.lock()
            .affinity
            .retain(|_, affinity| affinity.index != index || affinity.source_root == root);
        self.ready.notify_all();
    }
}

#[cfg(test)]
#[path = "_tests_/pool_sources_tests.rs"]
mod pool_sources_tests;
