//! Graceful cancellation and immediate termination share process ownership.

use crate::error::Result;
use crate::pool::Pool;

impl Pool {
    pub(super) fn cancel_busy(&self) -> Result<()> {
        let controls = {
            let mut state = self.lock()?;
            state.stopped = true;
            let busy: Vec<_> = state
                .controls
                .keys()
                .filter(|index| state.slots[**index].is_none())
                .copied()
                .collect();
            let controls = busy
                .into_iter()
                .filter_map(|index| state.controls.remove(&index))
                .collect::<Vec<_>>();
            self.ready.notify_all();
            controls
        };
        let mut failure = None;
        for control in controls {
            if let Err(error) = control.kill() {
                failure.get_or_insert(error);
            }
        }
        failure.map_or(Ok(()), Err)
    }

    pub(super) fn stop(&self, force: bool) -> Result<()> {
        let controls = {
            let mut state = self.lock()?;
            state.stopped = true;
            self.ready.notify_all();
            state.controls.values().cloned().collect::<Vec<_>>()
        };
        let mut error = None;
        if force {
            for control in controls {
                if let Err(failure) = control.kill() {
                    error = Some(failure);
                }
            }
        } else {
            let deadline = self.clock.now_ms().saturating_add(2_000);
            for control in &controls {
                if let Err(failure) = control.shutdown() {
                    error = Some(failure);
                }
            }
            for control in controls {
                if let Err(failure) = control.finish(deadline) {
                    error = Some(failure);
                }
            }
        }
        match error {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}
