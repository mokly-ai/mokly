//! Serve sidecar admission groups foreground requests before queued base work.

use std::path::Path;
use std::sync::{Arc, Weak};

use mokly_graph::render_class::RenderClass;
use mokly_graph::write_activity::WriteActivity;

use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;
use mokly_server::foreground::{Foreground, ForegroundLease};
use mokly_sidecar::error::Result;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{ReturnWake, SidecarPool};
use mokly_sidecar::pool_admission::PoolCapacity;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;

use crate::serve_gate::Gate;
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
    pub(super) fn new(inner: Arc<dyn SidecarPool>, capacity: Arc<dyn PoolCapacity>) -> Self {
        let gate = Arc::new(Gate::new(capacity));
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

    /// Suppress optional writes while calls or existing maintenance remain active.
    pub(super) fn with_activity(self, activity: Arc<dyn WriteActivity>) -> Self {
        *self
            .gate
            .activity
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(activity);
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
        self.gate.capacity.capacity()
    }
}

struct ScheduledPool {
    inner: Arc<dyn SidecarPool>,
    gate: Arc<Gate>,
    base: Option<Arc<dyn ChangeCancellation>>,
}

impl SidecarPool for ScheduledPool {
    fn record_served_render(&self, source_root: &Path, call: Call) {
        self.inner.record_served_render(source_root, call);
    }
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
        let _activity = self.gate.activity();
        let _foreground = self.base.is_none().then(|| self.gate.foreground());
        let admission = self
            .gate
            .acquire(self.base.as_deref(), RenderClass::current())?;
        self.inner.request_claimed(call, &admission.claim)
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
pub(crate) mod serve_pool_support;

#[cfg(test)]
#[path = "_tests_/serve_pool_tests.rs"]
mod serve_pool_tests;

#[cfg(test)]
#[path = "_tests_/serve_capacity_tests.rs"]
mod serve_capacity_tests;

#[cfg(test)]
#[path = "_tests_/serve_priority_tests.rs"]
mod serve_priority_tests;

#[cfg(test)]
#[path = "_tests_/serve_coalescing_tests.rs"]
mod serve_coalescing_tests;

#[cfg(test)]
#[path = "_tests_/serve_claim_tests.rs"]
mod serve_claim_tests;

#[cfg(test)]
#[path = "_tests_/serve_claim_order_tests.rs"]
mod serve_claim_order_tests;

#[cfg(test)]
#[path = "_tests_/serve_return_admission_tests.rs"]
mod serve_return_admission_tests;

#[cfg(test)]
#[path = "_tests_/serve_claim_failure_support.rs"]
mod serve_claim_failure_support;

#[cfg(test)]
#[path = "_tests_/serve_claim_failure_tests.rs"]
mod serve_claim_failure_tests;

#[cfg(test)]
#[path = "_tests_/serve_claim_retirement_tests.rs"]
mod serve_claim_retirement_tests;

#[cfg(test)]
#[path = "_tests_/serve_warmup_activity_tests.rs"]
mod serve_warmup_activity_tests;
