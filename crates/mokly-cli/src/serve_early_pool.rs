//! Early base calls keep one process and yield to complete HTTP renders.

use std::sync::{Arc, Mutex};

use mokly_server::changes::ChangeCancellation;
use mokly_server::usage_completion::UsageCompletion;
use mokly_sidecar::early_lease::{EarlyCall, EarlyLease, EarlyRetry};
use mokly_sidecar::error::{Error, Result};
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::wire::MethodResult;

use crate::serve_pool_gate::{Gate, Lease};
use crate::serve_return::ReturnAdmission;

/// Preparation finishes early process work before base capture admission.
#[cfg_attr(test, unimock::unimock(api = PreparingPoolMock))]
pub trait PreparingPool: SidecarPool {
    /// End and reap an early process without losing its generation recipes.
    fn finish(&self);
}

enum State {
    Seeking,
    Leased {
        inner: Box<dyn EarlyLease>,
        _capacity: Lease,
    },
    Ordinary,
}

pub(super) struct EarlyPool {
    inner: Arc<dyn SidecarPool>,
    ordinary: Arc<dyn SidecarPool>,
    gate: Arc<Gate>,
    cancel: Arc<dyn ChangeCancellation>,
    usage: Arc<dyn UsageCompletion>,
    state: Mutex<State>,
}

impl EarlyPool {
    pub(super) fn new(
        inner: Arc<dyn SidecarPool>,
        ordinary: Arc<dyn SidecarPool>,
        gate: Arc<Gate>,
        cancel: Arc<dyn ChangeCancellation>,
        usage: Arc<dyn UsageCompletion>,
    ) -> Self {
        Self {
            inner,
            ordinary,
            gate,
            cancel,
            usage,
            state: Mutex::new(State::Seeking),
        }
    }

    fn acquire(&self, state: &mut State, call: &Call) -> Result<()> {
        if matches!(state, State::Seeking) && self.usage.settled() {
            *state = State::Ordinary;
            return Ok(());
        }
        let span = tracing::info_span!("review.base-gate-wait", status = "error");
        let _scope = span.enter();
        loop {
            let version = self.gate.early_wake.version();
            {
                let mut gate = self
                    .gate
                    .state
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                if gate.closed || self.cancel.cancelled() {
                    return Err(Error::Cancelled);
                }
                if matches!(state, State::Seeking) && self.usage.settled() {
                    *state = State::Ordinary;
                    span.record("status", "ok");
                    return Ok(());
                }
                if gate.http == 0 {
                    if matches!(state, State::Leased { .. }) {
                        span.record("status", "ok");
                        return Ok(());
                    }
                    if gate.active < self.gate.limit
                        && gate.waiting == 0
                        && let Some(inner) = self.inner.try_early(call)?
                    {
                        gate.active += 1;
                        *state = State::Leased {
                            inner,
                            _capacity: Lease {
                                gate: self.gate.clone(),
                                foreground: false,
                                http: false,
                                active: true,
                            },
                        };
                        span.record("status", "ok");
                        return Ok(());
                    }
                }
            }
            self.gate.early_wake.wait(version);
        }
    }
}

impl PreparingPool for EarlyPool {
    fn finish(&self) {
        let previous = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            std::mem::replace(&mut *state, State::Ordinary)
        };
        if let State::Leased { inner, _capacity } = previous
            && let Err(error) = inner.finish()
        {
            self.gate.failed(&error);
        }
    }
}

impl SidecarPool for EarlyPool {
    fn served_generation(&self, generation: &str, epoch: u64) {
        self.ordinary.served_generation(generation, epoch);
    }
    fn request(&self, call: Call) -> Result<MethodResult> {
        let result = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if !matches!(*state, State::Ordinary) {
                self.acquire(&mut state, &call)?;
            }
            match &*state {
                State::Leased { inner, .. } => Some(inner.request(call.clone())),
                _ => None,
            }
        };
        match result {
            Some(EarlyCall::Complete(result)) => result,
            Some(outcome) => {
                self.finish();
                if !self.usage.wait(self.cancel.as_ref()) {
                    return Err(Error::Cancelled);
                }
                match outcome {
                    EarlyCall::Retry(failure) => self.ordinary.retry(call, failure),
                    _ => self.ordinary.request(call),
                }
            }
            None => self.ordinary.request(call),
        }
    }
    fn retry(&self, call: Call, failure: EarlyRetry) -> Result<MethodResult> {
        self.ordinary.retry(call, failure)
    }
    fn release_generation(&self, generation: &str, epoch: u64) {
        self.ordinary.release_generation(generation, epoch);
    }
    fn release_context(&self, context: &str) {
        self.ordinary.release_context(context);
    }
    fn cancel_requests(&self) -> Result<()> {
        self.ordinary.cancel_requests()
    }
    fn shutdown(&self) -> Result<()> {
        self.ordinary.shutdown()
    }
    fn abort(&self) -> Result<()> {
        self.ordinary.abort()
    }
}
