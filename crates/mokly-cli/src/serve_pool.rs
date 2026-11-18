//! Serve sidecar admission groups foreground requests before queued base work.

use std::sync::{Arc, Condvar, Mutex, Weak};

use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;
use mokly_server::foreground::{Foreground, ForegroundLease};
use mokly_sidecar::error::{Error, Result};
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{ReturnWake, SidecarPool};
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;

use crate::serve_return::{self, ReturnAdmission};

/// Committed classification completion records background work only.
#[cfg_attr(test, unimock::unimock(api = BaseCompletionMock))]
pub(super) trait BaseCompletion: Send + Sync {
    /// Record a return pass after committed Changes completion.
    fn base_finished(&self) {}
}

/// Both sides retain the same bounded process pool and admission owner.
#[cfg_attr(test, unimock::unimock(api = PoolSchedulingMock))]
pub(super) trait PoolScheduling: Foreground + BaseCompletion {
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
        let gate = Arc::new(Gate {
            state: Mutex::new(State::default()),
            changed: Condvar::new(),
            limit,
            return_wake: Mutex::new(None),
            diagnostics: Mutex::new(None),
        });
        let admission: Arc<dyn ReturnAdmission> = gate.clone();
        let wake = serve_return::start(&inner, Arc::downgrade(&admission));
        *gate
            .return_wake
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(wake);
        Self { inner, gate }
    }

    /// Use the process diagnostic reporter for background return failures.
    pub(super) fn with_diagnostics(self, diagnostics: Arc<dyn Diagnostics>) -> Self {
        *self
            .gate
            .diagnostics
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(diagnostics);
        self
    }
}

impl Foreground for ServePool {
    fn enter(&self) -> Box<dyn ForegroundLease> {
        Box::new(self.gate.foreground())
    }
}

impl BaseCompletion for ServePool {
    fn base_finished(&self) {
        self.inner.schedule_head_return();
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
    waiting_base: usize,
    closed: bool,
}

struct Gate {
    state: Mutex<State>,
    changed: Condvar,
    limit: usize,
    return_wake: Mutex<Option<Arc<serve_return::Wake>>>,
    diagnostics: Mutex<Option<Arc<dyn Diagnostics>>>,
}

impl ReturnAdmission for Gate {
    fn ready(&self) -> bool {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        !state.closed && state.waiting_base == 0
    }
    fn failed(&self, error: &Error) {
        let diagnostics = self
            .diagnostics
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        if let Some(diagnostics) = diagnostics {
            if let Error::HeadReturnDisabled { source } = error {
                diagnostics.emit(&source.to_string());
                diagnostics.emit(
                    "[mokly/warning] Background sidecar preparation is disabled. Restart Serve.",
                );
            } else {
                diagnostics.emit(&error.to_string());
            }
        }
    }
}

impl Gate {
    fn wake_return(&self) {
        if let Some(wake) = &*self
            .return_wake
            .lock()
            .unwrap_or_else(|error| error.into_inner())
        {
            wake.admission_changed();
        }
    }
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
        state.waiting_base += usize::from(base.is_some());
        self.changed.notify_all();
        loop {
            if state.closed || base.is_some_and(ChangeCancellation::cancelled) {
                state.waiting -= 1;
                state.waiting_base -= usize::from(base.is_some());
                self.changed.notify_all();
                self.wake_return();
                return Err(Error::Cancelled);
            }
            if state.active < self.limit && (base.is_none() || state.foreground == 0) {
                state.active += 1;
                state.waiting -= 1;
                state.waiting_base -= usize::from(base.is_some());
                self.wake_return();
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
        self.gate.wake_return();
    }
}

struct ScheduledPool {
    inner: Arc<dyn SidecarPool>,
    gate: Arc<Gate>,
    base: Option<Arc<dyn ChangeCancellation>>,
}

impl SidecarPool for ScheduledPool {
    fn served_generation(&self, generation: &str, epoch: u64) {
        self.inner.served_generation(generation, epoch);
    }
    fn schedule_head_return(&self) {
        self.inner.schedule_head_return();
    }
    fn maintain_head_return(&self) -> Result<bool> {
        self.inner.maintain_head_return()
    }
    fn observe_head_return(&self, wake: Weak<dyn ReturnWake>) {
        self.inner.observe_head_return(wake);
    }
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

#[cfg(test)]
#[path = "_tests_/serve_return_admission_tests.rs"]
mod serve_return_admission_tests;
