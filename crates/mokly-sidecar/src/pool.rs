//! Lazy bounded sidecar pool, queueing, retry, recycling, and cancellation.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, Weak};

use crate::bundle_store::BundleStore;
use crate::early_lease::{EarlyLease, EarlyRetry};
use crate::error::{Error, Result};
use crate::methods::Call;
use crate::pool_cleanup;
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_releases::Notice;
use crate::pool_state::{Slot, State};
use crate::pool_timing::Reason;
use crate::wire::MethodResult;
use crate::workers::{Clock, WorkerFactory};

/// Wake the Serve owner when a pending head return can make progress.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ReturnWakeMock))]
pub trait ReturnWake: Send + Sync {
    /// Record ready maintenance without waiting for a process.
    fn notify(&self);
}

/// Pool boundary consumed by catalogue and rendering services.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PoolMock))]
pub trait SidecarPool: Send + Sync {
    /// Atomically claim an idle non-warm or empty slot without entering the request FIFO.
    fn try_early(&self, _call: &Call) -> Result<Option<Box<dyn EarlyLease>>> {
        Ok(None)
    }

    /// Wake Serve when a slot change can admit an early preparation.
    fn observe_available(&self, _wake: Weak<dyn ReturnWake>) {}

    /// Enqueue one request and return its complete result, or fail closed.
    fn request(&self, call: Call) -> Result<MethodResult>;
    /// Resume only the one remaining retry after an early process was retired.
    fn retry(&self, call: Call, failure: EarlyRetry) -> Result<MethodResult>;
    /// Record an epoch-specific final lease release without waiting for a worker.
    fn release_generation(&self, generation: &str, epoch: u64);
    /// Apply the served-recipe write rule after the core directly reuses a live state.
    fn served_generation(&self, generation: &str, epoch: u64);
    /// Record a final PostCSS context release without waiting for a worker.
    fn release_context(&self, context: &str);
    /// Record one return pass without waiting for a process.
    fn schedule_head_return(&self) {}
    /// Replace at most one idle base process, returning whether work was taken.
    fn maintain_head_return(&self) -> Result<bool> {
        Ok(false)
    }
    /// Observe slot changes through a weak handle owned by Serve.
    fn observe_head_return(&self, _wake: Weak<dyn ReturnWake>) {}
    /// Cancel queued calls, kill and reap busy workers, and retain idle workers for shutdown.
    fn cancel_requests(&self) -> Result<()>;
    /// Cancel work, allow a two-second exit grace, then kill and reap survivors.
    fn shutdown(&self) -> Result<()>;
    /// Kill every owned process without waiting for the graceful shutdown deadline.
    fn abort(&self) -> Result<()>;
}

/// Process pool composed from explicit process and clock boundaries.
#[derive(Clone)]
pub struct Pool {
    pub(super) factory: Arc<dyn WorkerFactory>,
    pub(super) starting: Arc<Mutex<()>>,
    pub(super) clock: Arc<dyn Clock>,
    pub(super) launch: Launch,
    pub(super) options: PoolOptions,
    pub(super) state: Arc<Mutex<State>>,
    pub(super) releases: Option<Sender<Notice>>,
    pub(super) ready: Arc<Condvar>,
    pub(super) bundle_store: Option<Arc<dyn BundleStore>>,
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
            starting: Arc::new(Mutex::new(())),
            clock,
            launch,
            options,
            state: Arc::new(Mutex::new(State::default())),
            ready: Arc::new(Condvar::new()),
            releases: Some(sender),
            bundle_store: None,
        };
        pool.start_releases(receiver);
        pool
    }

    /// Add optional persistent recipes without starting a process or accessing disk.
    pub fn with_bundle_store(mut self, store: Arc<dyn BundleStore>) -> Self {
        self.bundle_store = Some(store);
        self
    }

    pub(super) fn lock(&self) -> MutexGuard<'_, State> {
        pool_cleanup::lock(&self.state)
    }

    pub(super) fn spawn(&self, index: usize, source_root: &Path) -> Result<Slot> {
        let reason = {
            let state = self.lock();
            state.replacement_reasons.get(&index).map(|reason| {
                if state.early == Some(index) {
                    Reason::EarlyPreparation
                } else {
                    *reason
                }
            })
        };
        let recycle = reason.map(Reason::replacement);
        let _recycle_scope = recycle.as_ref().map(tracing::Span::enter);
        let span = tracing::info_span!("sidecar.spawn", status = "error");
        let _scope = span.enter();
        if self.lock().stopped {
            return Err(Error::Cancelled);
        }
        self.forget_other_roots(index, source_root);
        {
            let mut state = self.lock();
            state.memory.entry(index).or_default().started();
            state.replacement_reasons.insert(index, Reason::Retry);
        }
        let launch = Launch {
            capture_durability: self.bundle_store.is_some(),
            repository: source_root.into(),
            ..self.launch.clone()
        };
        let mut spawned = self.factory.spawn(&launch)?;
        let (stopped, early) = {
            let mut state = self.lock();
            state.controls.insert(index, Arc::clone(&spawned.control));
            state.source_roots.insert(index, source_root.into());
            (state.stopped, state.early == Some(index))
        };
        if stopped {
            if early {
                self.reap_early_control(index, spawned.control.as_ref());
            } else {
                spawned.control.kill()?;
            }
            return Err(Error::Cancelled);
        }
        if let Err(error) = spawned
            .worker
            .handshake(self.options.timeout_ms.unwrap_or(30_000))
        {
            if early {
                self.reap_early_control(index, spawned.control.as_ref());
            } else if self.lock().stopped {
                spawned.control.kill()?;
            } else {
                Reason::Retry.kill(spawned.control.as_ref())?;
            }
            return Err(error);
        }
        self.lock().replacement_reasons.remove(&index);
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

    pub(super) fn release(&self, index: usize, mut slot: Option<Slot>) {
        if let Some(current) = &mut slot
            && let Err(error) = self.cleanup(current)
        {
            tracing::warn!(%error, "sidecar cleanup failed");
            let stopped = {
                let mut state = self.lock();
                state.replacement_reasons.insert(index, Reason::Replacement);
                state.stopped
            };
            let _ = if stopped {
                current.control.kill()
            } else {
                Reason::Replacement.kill(current.control.as_ref())
            };
            slot = None;
        }
        let mut state = self.lock();
        state.slots[index] = if state.stopped { None } else { slot };
        if state.slots[index].is_none() {
            state.controls.remove(&index);
            state.source_roots.remove(&index);
        }
        state.available.push_back(index);
        if state.slots[index]
            .as_ref()
            .is_some_and(|slot| pool_cleanup::pending(&state, slot))
            && let Some(sender) = &self.releases
        {
            let _ = sender.send(Notice::Work);
        }
        state.head.notify();
        self.ready.notify_all();
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
