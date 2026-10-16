//! A process never evaluates two source roots under one working directory.

use std::path::{Path, PathBuf};

use crate::error::Result;
use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_requests::generation;
use crate::pool_state::Slot;

impl Pool {
    pub(super) fn source_root(&self, call: &Call) -> Result<Option<PathBuf>> {
        let state = self.lock()?;
        let source = match call {
            Call::Bundle(params) => Some(params.source_root.clone()),
            Call::RestoreGeneration(params) => Some(params.params.source_root.clone()),
            Call::ProcessCss(params) => Some(params.source_root.clone()),
            _ => generation(call).and_then(|id| {
                state
                    .bundles
                    .get(id)
                    .map(|bundle| bundle.source_root.clone())
            }),
        };
        Ok(source.map(PathBuf::from))
    }

    pub(super) fn isolate(&self, slot: &mut Option<Slot>, root: Option<&Path>) -> Result<()> {
        if let Some(current) = slot.as_ref()
            && root.is_some_and(|root| root != current.source_root)
        {
            current.control.kill()?;
            *slot = None;
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/pool_sources_tests.rs"]
mod pool_sources_tests;
