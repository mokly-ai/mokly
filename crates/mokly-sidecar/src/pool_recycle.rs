//! Memory recycling keeps its back-off across worker replacements in one slot.

use crate::error::Result;
use crate::pool::Pool;
use crate::pool_state::Slot;
use crate::pool_timing::Reason;

impl Pool {
    pub(super) fn recycle(&self, index: usize, slot: &mut Option<Slot>) -> Result<()> {
        let Some(current) = slot.as_mut() else {
            return Ok(());
        };
        current.requests += 1;
        let due = self
            .lock()?
            .memory
            .entry(index)
            .or_default()
            .due(current.requests);
        let memory = if due {
            current.worker.resident_bytes().ok()
        } else {
            None
        };
        let pressure = match memory {
            Some(bytes) => self
                .lock()?
                .memory
                .entry(index)
                .or_default()
                .sample(current.requests, bytes),
            None => None,
        };
        if pressure == Some(true) {
            current.worker.memory_pressure();
        }
        if current.renders < 500 && pressure.is_none() {
            return Ok(());
        }
        let stopped = {
            let mut state = self.lock()?;
            state.replacement_reasons.insert(index, Reason::Recycle);
            state.stopped
        };
        let span = (!stopped).then(|| Reason::Recycle.stop());
        let _scope = span.as_ref().map(tracing::Span::enter);
        let drained = current.control.shutdown().and_then(|()| {
            current
                .control
                .finish(self.clock.now_ms().saturating_add(2_000))
        });
        if let Err(error) = drained {
            tracing::warn!(%error, "sidecar recycle shutdown failed");
            if let Err(error) = current.control.kill() {
                tracing::warn!(%error, "sidecar recycle kill failed");
            }
        } else if let Some(span) = &span {
            span.record("status", "ok");
        }
        *slot = None;
        Ok(())
    }
}
