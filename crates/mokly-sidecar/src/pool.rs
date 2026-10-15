//! Lazy bounded sidecar pool, queueing, retry, recycling, and cancellation.

use std::collections::BTreeSet;
use std::sync::{Arc, Condvar, Mutex, MutexGuard};

use crate::error::{Error, FailureKind, InternalError, ProtocolError, Result};
use crate::methods::Call;
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::{Slot, State};
use crate::wire::MethodResult;
use crate::workers::{Clock, WorkerFactory};

/// Pool boundary consumed by catalogue and rendering services.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PoolMock))]
pub trait SidecarPool: Send + Sync {
    /// Enqueue one request and return its complete result, or fail closed.
    fn request(&self, call: Call) -> Result<MethodResult>;
    /// Cancel queued work, drain active requests, and bound shutdown to two seconds.
    fn shutdown(&self) -> Result<()>;
}

/// Process pool composed from explicit process and clock boundaries.
pub struct Pool {
    pub(super) factory: Arc<dyn WorkerFactory>,
    pub(super) clock: Arc<dyn Clock>,
    pub(super) launch: Launch,
    pub(super) options: PoolOptions,
    state: Mutex<State>,
    ready: Condvar,
}

impl Pool {
    /// Construct a pool without starting any process.
    pub fn new(
        factory: Arc<dyn WorkerFactory>,
        clock: Arc<dyn Clock>,
        launch: Launch,
        options: PoolOptions,
    ) -> Self {
        Self {
            factory,
            clock,
            launch,
            options,
            state: Mutex::new(State::default()),
            ready: Condvar::new(),
        }
    }

    pub(super) fn lock(&self) -> Result<MutexGuard<'_, State>> {
        match self.state.lock() {
            Ok(state) => Ok(state),
            Err(_) => Err(InternalError::Synchronization.into()),
        }
    }

    fn acquire(&self) -> Result<(usize, Option<Slot>)> {
        let mut state = self.lock()?;
        let ticket = state.ticket;
        state.ticket += 1;
        loop {
            if state.stopped {
                return Err(Error::Cancelled);
            }
            if ticket == state.serving {
                let index = state.available.pop_front().or_else(|| {
                    if state.slots.len() < self.options.size.max(1) {
                        state.slots.push(None);
                        Some(state.slots.len() - 1)
                    } else {
                        None
                    }
                });
                if let Some(index) = index {
                    state.serving += 1;
                    let slot = state.slots[index].take();
                    self.ready.notify_all();
                    return Ok((index, slot));
                }
            }
            state = match self.ready.wait(state) {
                Ok(state) => state,
                Err(_) => return Err(InternalError::Synchronization.into()),
            };
        }
    }

    fn spawn(&self, index: usize) -> Result<Slot> {
        if self.lock()?.stopped {
            return Err(Error::Cancelled);
        }
        let mut spawned = self.factory.spawn(&self.launch)?;
        {
            let mut state = self.lock()?;
            if state.stopped {
                spawned.control.kill()?;
                return Err(Error::Cancelled);
            }
            state.controls.insert(index, Arc::clone(&spawned.control));
        }
        if let Err(error) = spawned
            .worker
            .handshake(self.options.timeout_ms.unwrap_or(30_000))
        {
            spawned.control.kill()?;
            return Err(error);
        }
        Ok(Slot {
            worker: spawned.worker,
            control: spawned.control,
            generations: BTreeSet::new(),
            maps: BTreeSet::new(),
            described: BTreeSet::new(),
            renders: 0,
        })
    }

    fn release(&self, index: usize, slot: Option<Slot>) -> Result<()> {
        let mut state = self.lock()?;
        state.slots[index] = slot;
        if state.slots[index].is_none() {
            state.controls.remove(&index);
        }
        state.available.push_back(index);
        self.ready.notify_all();
        Ok(())
    }
}

impl SidecarPool for Pool {
    fn request(&self, call: Call) -> Result<MethodResult> {
        if matches!(call, Call::Shutdown(_)) {
            self.shutdown()?;
            return Ok(MethodResult::Empty);
        }
        if matches!(call, Call::Hello(_)) {
            return Err(Error::Protocol(ProtocolError::Handshake));
        }
        let (index, mut slot) = self.acquire()?;
        let deadline = self.options.timeout_ms.unwrap_or_else(|| call.timeout_ms());
        let mut outcome = Err(Error::Crashed);
        for attempt in 0..2 {
            if self.lock()?.stopped {
                outcome = Err(Error::Cancelled);
                break;
            }
            let mut current = match slot.take() {
                Some(slot) => slot,
                None => match self.spawn(index) {
                    Ok(slot) => slot,
                    Err(error) => {
                        let retryable = matches!(error, Error::Crashed | Error::Timeout { .. });
                        outcome = Err(error);
                        if retryable && attempt == 0 {
                            continue;
                        }
                        break;
                    }
                },
            };
            outcome = self.execute(&mut current, &call, deadline);
            let retryable = matches!(&outcome, Err(Error::Crashed | Error::Timeout { .. }));
            let reusable = outcome.is_ok()
                || matches!(&outcome, Err(Error::Remote { code, .. }) if code.reusable());
            if !reusable {
                let killed = current.control.kill();
                if let Err(error) = killed {
                    outcome = Err(error);
                    break;
                }
                if retryable && attempt == 0 {
                    continue;
                }
            } else {
                slot = Some(current);
            }
            break;
        }
        if let Some(current) = slot.as_ref() {
            let memory = current.worker.resident_bytes();
            if current.renders >= 500 || matches!(memory, Ok(bytes) if bytes > 1024 * 1024 * 1024) {
                let drained = current.control.shutdown().and_then(|()| {
                    current
                        .control
                        .finish(self.clock.now_ms().saturating_add(2_000))
                });
                if let Err(error) = drained {
                    outcome = Err(error);
                }
                slot = None;
            }
        }
        let cancelled = self.lock()?.stopped;
        self.release(index, slot)?;
        if matches!(outcome, Err(Error::Crashed)) {
            let kind = if matches!(
                call,
                Call::Bundle(_) | Call::Describe(_) | Call::ProcessCss(_)
            ) {
                FailureKind::Bundle
            } else {
                FailureKind::Render
            };
            outcome = Err(Error::RequestCrashed {
                kind,
                call: Box::new(call),
            });
        }
        if cancelled {
            Err(Error::Cancelled)
        } else {
            outcome
        }
    }

    fn shutdown(&self) -> Result<()> {
        let controls = {
            let mut state = self.lock()?;
            state.stopped = true;
            self.ready.notify_all();
            state.controls.values().cloned().collect::<Vec<_>>()
        };
        let deadline = self.clock.now_ms().saturating_add(2_000);
        let mut error = None;
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
        match error {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/pool_tests.rs"]
mod pool_tests;

#[cfg(test)]
#[path = "_tests_/pool_recycle_tests.rs"]
mod pool_recycle_tests;

#[cfg(test)]
#[path = "_tests_/pool_cancel_tests.rs"]
mod pool_cancel_tests;

#[cfg(test)]
#[path = "_tests_/pool_replay_tests.rs"]
mod pool_replay_tests;
