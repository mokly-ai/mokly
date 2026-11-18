//! Admission separates whole HTTP leases from individual head sidecar calls.

use std::sync::{Arc, Condvar, Mutex};

use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;
use mokly_server::foreground::ForegroundLease;
use mokly_sidecar::error::{Error, Result};
use mokly_sidecar::workers::Diagnostics;

use crate::serve_early_wake::PreparationWake;
use crate::serve_return::{self, ReturnAdmission};

#[derive(Default)]
pub(super) struct State {
    pub(super) active: usize,
    pub(super) foreground: usize,
    pub(super) http: usize,
    pub(super) waiting: usize,
    pub(super) waiting_base: usize,
    pub(super) closed: bool,
}

pub(super) struct Gate {
    pub(super) early_wake: Arc<dyn PreparationWake>,
    pub(super) state: Mutex<State>,
    pub(super) changed: Condvar,
    pub(super) limit: usize,
    pub(super) return_wake: Mutex<Option<Arc<serve_return::Wake>>>,
    pub(super) diagnostics: Mutex<Option<Arc<dyn Diagnostics>>>,
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
    pub(super) fn wake_return(&self) {
        self.early_wake.wake();
        if let Some(wake) = &*self
            .return_wake
            .lock()
            .unwrap_or_else(|error| error.into_inner())
        {
            wake.admission_changed();
        }
    }
    pub(super) fn foreground(self: &Arc<Self>, http: bool) -> Lease {
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.foreground += 1;
            state.http += usize::from(http);
        }
        self.changed.notify_all();
        Lease {
            gate: self.clone(),
            foreground: true,
            http,
            active: false,
        }
    }

    pub(super) fn acquire(
        self: &Arc<Self>,
        base: Option<&dyn ChangeCancellation>,
    ) -> Result<Lease> {
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
                    http: false,
                    active: true,
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
        self.early_wake.wake();
        self.changed.notify_all();
    }
}

impl ChangeSignal for Gate {
    fn notify(&self) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.changed.notify_all();
    }
}

pub(super) struct Lease {
    pub(super) gate: Arc<Gate>,
    pub(super) foreground: bool,
    pub(super) http: bool,
    pub(super) active: bool,
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
        state.http -= usize::from(self.http);
        self.gate.changed.notify_all();
        self.gate.wake_return();
    }
}
