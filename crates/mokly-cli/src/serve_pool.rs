//! Serve sidecar admission groups foreground requests before queued base work.

use std::sync::{Arc, Condvar, Mutex};

use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;
use mokly_server::foreground::{Foreground, ForegroundLease};
use mokly_sidecar::error::{Error, Result};
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::wire::MethodResult;

/// Both sides retain the same bounded process pool and admission owner.
#[cfg_attr(test, unimock::unimock(api = PoolSchedulingMock))]
pub(super) trait PoolScheduling: Foreground {
    /// Current work has priority; a base handle observes its attempt's cancellation.
    fn pool(&self, base: Option<Arc<dyn ChangeCancellation>>) -> Arc<dyn SidecarPool>;
    /// The number of sidecar calls that admission runs at once, at least one.
    fn limit(&self) -> usize;
}

/// One foreground counter and request bound surround the shared process pool.
pub(super) struct ServePool {
    inner: Arc<dyn SidecarPool>,
    gate: Arc<Gate>,
}

impl ServePool {
    /// Create admission without starting a worker or changing a sidecar deadline.
    pub(super) fn new(inner: Arc<dyn SidecarPool>, limit: usize) -> Self {
        Self {
            inner,
            gate: Arc::new(Gate {
                state: Mutex::new(State::default()),
                changed: Condvar::new(),
                limit: limit.max(1),
            }),
        }
    }
}

impl Foreground for ServePool {
    fn enter(&self) -> Box<dyn ForegroundLease> {
        Box::new(self.gate.foreground())
    }
}

impl PoolScheduling for ServePool {
    fn pool(&self, base: Option<Arc<dyn ChangeCancellation>>) -> Arc<dyn SidecarPool> {
        if let Some(cancel) = &base {
            let signal: Arc<dyn ChangeSignal> = self.gate.clone();
            cancel.observe(Arc::downgrade(&signal));
        }
        Arc::new(ScheduledPool {
            inner: self.inner.clone(),
            gate: self.gate.clone(),
            base,
        })
    }
    fn limit(&self) -> usize {
        self.gate.limit
    }
}

#[derive(Default)]
struct State {
    active: usize,
    foreground: usize,
    waiting: usize,
    closed: bool,
}

struct Gate {
    state: Mutex<State>,
    changed: Condvar,
    limit: usize,
}

impl Gate {
    fn foreground(self: &Arc<Self>) -> Lease {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .foreground += 1;
        self.changed.notify_all();
        Lease {
            gate: self.clone(),
            foreground: true,
            active: false,
        }
    }

    fn acquire(self: &Arc<Self>, base: Option<&dyn ChangeCancellation>) -> Result<Lease> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.waiting += 1;
        self.changed.notify_all();
        loop {
            if state.closed || base.is_some_and(ChangeCancellation::cancelled) {
                state.waiting -= 1;
                self.changed.notify_all();
                return Err(Error::Cancelled);
            }
            if state.active < self.limit && (base.is_none() || state.foreground == 0) {
                state.active += 1;
                state.waiting -= 1;
                return Ok(Lease {
                    gate: self.clone(),
                    foreground: false,
                    active: true,
                });
            }
            state = self
                .changed
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
    }

    fn close(&self) {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .closed = true;
        self.changed.notify_all();
    }
}

impl ChangeSignal for Gate {
    fn notify(&self) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.changed.notify_all();
    }
}

struct Lease {
    gate: Arc<Gate>,
    foreground: bool,
    active: bool,
}
impl ForegroundLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        let mut state = self
            .gate
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.active -= usize::from(self.active);
        state.foreground -= usize::from(self.foreground);
        self.gate.changed.notify_all();
    }
}

struct ScheduledPool {
    inner: Arc<dyn SidecarPool>,
    gate: Arc<Gate>,
    base: Option<Arc<dyn ChangeCancellation>>,
}

impl SidecarPool for ScheduledPool {
    fn request(&self, call: Call) -> Result<MethodResult> {
        let _foreground = self.base.is_none().then(|| self.gate.foreground());
        let _admission = self.gate.acquire(self.base.as_deref())?;
        self.inner.request(call)
    }
    fn release_generation(&self, generation: &str, epoch: u64) {
        self.inner.release_generation(generation, epoch);
    }
    fn release_context(&self, context: &str) {
        self.inner.release_context(context);
    }
    fn cancel_requests(&self) -> Result<()> {
        self.gate.close();
        self.inner.cancel_requests()
    }
    fn shutdown(&self) -> Result<()> {
        self.gate.close();
        self.inner.shutdown()
    }
    fn abort(&self) -> Result<()> {
        self.gate.close();
        self.inner.abort()
    }
}

#[cfg(test)]
#[path = "_tests_/serve_pool_support.rs"]
mod serve_pool_support;

#[cfg(test)]
#[path = "_tests_/serve_pool_tests.rs"]
mod serve_pool_tests;
