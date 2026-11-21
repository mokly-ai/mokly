//! Call claims and HTTP priority in front of the shared Serve sidecar pool.

use std::sync::{Arc, Condvar, Mutex};

use mokly_graph::render_class::RenderClass;
use mokly_graph::write_activity::{WriteActivity, WriteLease};
use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;
use mokly_server::foreground::ForegroundLease;
use mokly_sidecar::error::{Error, Result};
use mokly_sidecar::pool_admission::PoolCapacity;
use mokly_sidecar::pool_claim::CallClaim;
use mokly_sidecar::workers::Diagnostics;

use crate::serve_return::{self, ReturnAdmission};

#[derive(Default)]
pub(super) struct State {
    pub(super) active: usize,
    pub(super) foreground: usize,
    pub(super) waiting: usize,
    pub(super) waiting_base: usize,
    waiting_http: usize,
    closed: bool,
}

pub(super) struct Gate {
    pub(super) capacity: Arc<dyn PoolCapacity>,
    pub(super) state: Mutex<State>,
    pub(super) changed: Condvar,
    pub(super) return_wake: Mutex<Option<Arc<serve_return::Wake>>>,
    pub(super) diagnostics: Mutex<Option<Arc<dyn Diagnostics>>>,
    pub(super) activity: Mutex<Option<Arc<dyn WriteActivity>>>,
}

impl Gate {
    pub(super) fn new(capacity: Arc<dyn PoolCapacity>) -> Self {
        Self {
            state: Mutex::new(State::default()),
            changed: Condvar::new(),
            capacity,
            return_wake: Mutex::new(None),
            diagnostics: Mutex::new(None),
            activity: Mutex::new(None),
        }
    }

    fn wake_return(&self) {
        if let Some(wake) = &*self
            .return_wake
            .lock()
            .unwrap_or_else(|error| error.into_inner())
        {
            wake.admission_changed();
        }
    }

    pub(super) fn foreground(self: &Arc<Self>) -> ForegroundGuard {
        let activity = self.activity();
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .foreground += 1;
        self.changed.notify_all();
        ForegroundGuard {
            gate: self.clone(),
            _activity: activity,
        }
    }

    pub(super) fn activity(&self) -> Option<Box<dyn WriteLease>> {
        let activity = self
            .activity
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        activity.map(|activity| activity.enter())
    }

    #[tracing::instrument(name = "serve.sidecar.admit", skip_all, err)]
    pub(super) fn acquire(
        self: &Arc<Self>,
        base: Option<&dyn ChangeCancellation>,
        class: RenderClass,
    ) -> Result<CallLease> {
        let http = base.is_none() && class == RenderClass::Foreground;
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.waiting += 1;
        state.waiting_base += usize::from(base.is_some());
        state.waiting_http += usize::from(http);
        self.changed.notify_all();
        let mut failure = Error::Cancelled;
        loop {
            if state.closed || base.is_some_and(ChangeCancellation::cancelled) {
                state.waiting -= 1;
                state.waiting_base -= usize::from(base.is_some());
                state.waiting_http -= usize::from(http);
                self.changed.notify_all();
                self.wake_return();
                return Err(failure);
            }
            if state.active < self.capacity.capacity()
                && (base.is_none() || state.foreground == 0)
                && (base.is_some() || class != RenderClass::Background || state.waiting_http == 0)
                && let Some(claim) = (match self.capacity.try_claim() {
                    Ok(claim) => claim,
                    Err(error) => {
                        failure = error;
                        state.closed = true;
                        continue;
                    }
                })
            {
                state.active += 1;
                state.waiting -= 1;
                state.waiting_base -= usize::from(base.is_some());
                state.waiting_http -= usize::from(http);
                self.wake_return();
                return Ok(CallLease {
                    claim,
                    _active: ActiveGuard { gate: self.clone() },
                });
            }
            state = self
                .changed
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
    }

    pub(super) fn close(&self) {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .closed = true;
        self.changed.notify_all();
    }
}

impl ReturnAdmission for Gate {
    fn early_ready(&self) -> bool {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        !state.closed && state.waiting == 0
    }
    fn activity(&self) -> Option<Box<dyn WriteLease>> {
        self.activity()
    }
    fn ready(&self) -> bool {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        !state.closed && state.waiting_base == 0
    }

    fn failed(&self, error: &Error) {
        {
            let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            self.changed.notify_all();
        }
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

impl ChangeSignal for Gate {
    fn notify(&self) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.changed.notify_all();
    }
}

/// Field order releases the pool claim before the gate wakes its queued calls.
pub(super) struct CallLease {
    pub(super) claim: CallClaim,
    _active: ActiveGuard,
}

struct ActiveGuard {
    gate: Arc<Gate>,
}

impl Drop for ActiveGuard {
    fn drop(&mut self) {
        let mut state = self
            .gate
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.active -= 1;
        self.gate.changed.notify_all();
        self.gate.wake_return();
    }
}

pub(super) struct ForegroundGuard {
    gate: Arc<Gate>,
    _activity: Option<Box<dyn WriteLease>>,
}

impl ForegroundLease for ForegroundGuard {}

impl Drop for ForegroundGuard {
    fn drop(&mut self) {
        let mut state = self
            .gate
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.foreground -= 1;
        self.gate.changed.notify_all();
        self.gate.wake_return();
    }
}
