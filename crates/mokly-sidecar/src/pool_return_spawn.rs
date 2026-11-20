//! Background hello retains control and ends unusable processes before handover.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use crate::error::Result;
use crate::pool::Pool;
use crate::pool_options::Launch;
use crate::pool_state::Slot;
use crate::pool_timing::Reason;

impl Pool {
    pub(super) fn spawn_return(&self, index: usize) -> Result<Option<Slot>> {
        let recycle = Reason::RootSwitch.replacement();
        let _recycle_scope = recycle.enter();
        let span = tracing::info_span!("sidecar.spawn", status = "error");
        let _scope = span.enter();
        let mut spawned = {
            let _starting = self
                .starting
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            {
                let mut state = self.lock();
                if state.stopped {
                    return Ok(None);
                }
                state.memory.entry(index).or_default().started();
            }
            let launch = Launch {
                repository: self.launch.repository.clone(),
                ..self.launch.clone()
            };
            let spawned = match self.factory.spawn(&launch) {
                Ok(spawned) => spawned,
                Err(failure) => return Err(failure.into_error()),
            };
            let mut state = self.lock();
            state.controls.insert(index, Arc::clone(&spawned.control));
            state.source_roots.insert(index, launch.repository);
            spawned
        };
        if let Err(error) = spawned
            .worker
            .handshake(self.options.timeout_ms.unwrap_or(30_000))
        {
            self.retire_return(index, spawned.control.as_ref())?;
            return Err(error);
        }
        self.lock().replacement_reasons.remove(&index);
        span.record("status", "ok");
        recycle.record("status", "ok");
        Ok(Some(Slot {
            source_root: self.launch.repository.clone(),
            worker: spawned.worker,
            control: spawned.control,
            generations: BTreeMap::new(),
            maps: BTreeSet::new(),
            described: BTreeSet::new(),
            bindings: BTreeMap::new(),
            contexts: BTreeSet::new(),
            renders: 0,
            requests: 0,
            last_compilation: None,
        }))
    }
}
