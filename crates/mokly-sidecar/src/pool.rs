//! Lazy bounded sidecar pool, queueing, retry, recycling, and cancellation.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};

use crate::error::{Error, InternalError, Result};
use crate::methods::Call;
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_releases::Notice;
use crate::pool_state::{Slot, State};
use crate::wire::MethodResult;
use crate::workers::{Clock, WorkerFactory};
use crate::{pool_affinity, pool_cleanup};

/// Pool boundary consumed by catalogue and rendering services.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PoolMock))]
pub trait SidecarPool: Send + Sync {
    /// Enqueue one request and return its complete result, or fail closed.
    fn request(&self, call: Call) -> Result<MethodResult>;
    /// Record an epoch-specific final lease release without waiting for a worker.
    fn release_generation(&self, generation: &str, epoch: u64);
    /// Record a final PostCSS context release without waiting for a worker.
    fn release_context(&self, context: &str);
    /// Cancel queued calls, kill and reap busy workers, and retain idle workers for shutdown.
    fn cancel_requests(&self) -> Result<()>;
    /// Cancel work, allow a two-second exit grace, then kill and reap survivors.
    fn shutdown(&self) -> Result<()>;
    /// Kill every owned process without waiting for the graceful shutdown deadline.
    fn abort(&self) -> Result<()>;
}

/// Process pool composed from explicit process and clock boundaries.
pub struct Pool {
    pub(super) factory: Arc<dyn WorkerFactory>,
    pub(super) clock: Arc<dyn Clock>,
    pub(super) launch: Launch,
    pub(super) options: PoolOptions,
    pub(super) state: Arc<Mutex<State>>,
    pub(super) releases: Option<Sender<Notice>>,
    pub(super) ready: Arc<Condvar>,
}

impl Pool {
    /// Construct a pool without starting any process.
    pub fn new(
        factory: Arc<dyn WorkerFactory>,
        clock: Arc<dyn Clock>,
        launch: Launch,
        options: PoolOptions,
    ) -> Self {
        let (sender, receiver) = mpsc::channel();
        let pool = Self {
            factory,
            clock,
            launch,
            options,
            state: Arc::new(Mutex::new(State::default())),
            ready: Arc::new(Condvar::new()),
            releases: Some(sender),
        };
        pool.start_releases(receiver);
        pool
    }

    pub(super) fn lock(&self) -> Result<MutexGuard<'_, State>> {
        match self.state.lock() {
            Ok(state) => Ok(state),
            Err(_) => Err(InternalError::Synchronization.into()),
        }
    }

    pub(super) fn acquire(
        &self,
        call: &Call,
        root: Option<&Path>,
    ) -> Result<(usize, Option<Slot>)> {
        let root = root.unwrap_or(&self.launch.repository);
        let mut state = self.lock()?;
        let ticket = state.ticket;
        state.ticket += 1;
        let context = match call {
            Call::ProcessCss(params) => Some(params.context.clone()),
            _ => None,
        };
        state.waiting.insert(ticket, context);
        self.ready.notify_all();
        loop {
            if state.stopped {
                state.waiting.remove(&ticket);
                return Err(Error::Cancelled);
            }
            let first = state
                .waiting
                .iter()
                .find(|(_, context)| {
                    pool_affinity::runnable(&state, context.as_deref(), self.options.size.get())
                })
                .map(|(ticket, _)| *ticket);
            if first == Some(ticket) {
                let index = pool_affinity::acquire(&mut state, call, root, self.options.size.get());
                if let Some(index) = index {
                    state.waiting.remove(&ticket);
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

    pub(super) fn spawn(&self, index: usize, source_root: &Path) -> Result<Slot> {
        let replacement = self.lock()?.memory.contains_key(&index);
        let recycle = replacement.then(|| tracing::info_span!("sidecar.recycle", status = "error"));
        let _recycle_scope = recycle.as_ref().map(tracing::Span::enter);
        let span = tracing::info_span!("sidecar.spawn", status = "error");
        let _scope = span.enter();
        if self.lock()?.stopped {
            return Err(Error::Cancelled);
        }
        self.forget_other_roots(index, source_root)?;
        self.lock()?.memory.entry(index).or_default().started();
        let launch = Launch {
            repository: source_root.into(),
            ..self.launch.clone()
        };
        let mut spawned = self.factory.spawn(&launch)?;
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
        span.record("status", "ok");
        if let Some(recycle) = &recycle {
            recycle.record("status", "ok");
        }
        Ok(Slot {
            source_root: source_root.into(),
            worker: spawned.worker,
            control: spawned.control,
            generations: BTreeMap::new(),
            maps: BTreeSet::new(),
            described: BTreeSet::new(),
            bindings: BTreeMap::new(),
            contexts: BTreeSet::new(),
            renders: 0,
            requests: 0,
        })
    }

    pub(super) fn release(&self, index: usize, mut slot: Option<Slot>) -> Result<()> {
        if let Some(current) = &mut slot
            && let Err(error) = self.cleanup(current)
        {
            tracing::warn!(%error, "sidecar cleanup failed");
            let _ = current.control.kill();
            slot = None;
        }
        let mut state = self.lock()?;
        state.slots[index] = if state.stopped { None } else { slot };
        if state.slots[index].is_none() {
            state.controls.remove(&index);
        }
        state.available.push_back(index);
        if state.slots[index]
            .as_ref()
            .is_some_and(|slot| pool_cleanup::pending(&state, slot))
            && let Some(sender) = &self.releases
        {
            let _ = sender.send(Notice::Work);
        }
        self.ready.notify_all();
        Ok(())
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

#[cfg(test)]
#[path = "_tests_/pool_concurrency_tests.rs"]
mod pool_concurrency_tests;

#[cfg(test)]
#[path = "_tests_/pool_edge_tests.rs"]
mod pool_edge_tests;

#[cfg(test)]
#[path = "_tests_/pool_reload_tests.rs"]
mod pool_reload_tests;

#[cfg(test)]
#[path = "_tests_/pool_abort_tests.rs"]
mod pool_abort_tests;

#[cfg(test)]
#[path = "_tests_/pool_pressure_tests.rs"]
mod pool_pressure_tests;

#[cfg(test)]
#[path = "_tests_/pool_lease_tests.rs"]
mod pool_lease_tests;

#[cfg(test)]
#[path = "_tests_/pool_context_tests.rs"]
mod pool_context_tests;

#[cfg(test)]
#[path = "_tests_/pool_scheduling_tests.rs"]
mod pool_scheduling_tests;

#[cfg(test)]
#[path = "_tests_/pool_shutdown_order_tests.rs"]
mod pool_shutdown_order_tests;

#[cfg(test)]
#[path = "_tests_/pool_provenance_tests.rs"]
mod pool_provenance_tests;
