//! One command-owned startup outcome waits for an authoritative ordinary pin.

use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex, Weak};

use mokly_catalogue::diagnostic::Warning;
use mokly_compare::base_startup::PreparedOutcome;
use mokly_compare::error::{Error, Result};
use mokly_graph::types::RenderGeneration;
use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;

use crate::serve_base_cancel::BaseLifetime;
use crate::serve_base_key::BaseKey;

/// Owned diagnostics and services follow one accepted preparation outcome.
pub(super) struct StartupReady {
    pub(super) result: Result<PreparedOutcome>,
    pub(super) warnings: Vec<Warning>,
    pub(super) cache: Option<PathBuf>,
    pub(super) lifetime: Option<Arc<dyn BaseLifetime>>,
}

/// The worker and ordinary classifier exchange one typed outcome through this seam.
pub(super) trait StartupHandoff: Send + Sync {
    /// Register the single worker before it can enter a blocking runtime.
    fn begin(&self, head: Arc<dyn RenderGeneration>, cancel: Arc<dyn ChangeCancellation>) -> bool;
    /// Publish the independently pinned key before heavy preparation.
    fn selected(&self, key: BaseKey);
    /// Hold the outcome until the supervisor confirms that the worker drained.
    fn complete(&self, ready: StartupReady);
    /// Wake classifiers after every worker exit, including a failed join.
    fn finished(&self);
    /// Reject another origin or key, drain obsolete work, and transfer once.
    fn take(
        &self,
        key: &BaseKey,
        head: &Arc<dyn RenderGeneration>,
        cancel: &dyn ChangeCancellation,
    ) -> Result<Option<StartupReady>>;
}

/// Process-local synchronization for the worker and its ordinary continuation.
#[derive(Default)]
pub(super) struct StartupState {
    wake: Arc<Wake>,
}

#[derive(Default)]
struct State {
    started: bool,
    running: bool,
    rejected: bool,
    head: Option<Weak<dyn RenderGeneration>>,
    cancel: Option<Arc<dyn ChangeCancellation>>,
    key: Option<BaseKey>,
    ready: Option<StartupReady>,
}

enum Handoff {
    Cancel(Option<Arc<dyn ChangeCancellation>>, Option<StartupReady>),
    Ready(bool, Option<StartupReady>),
    Waiting,
}

#[derive(Default)]
struct Wake {
    state: Mutex<State>,
    changed: Condvar,
}
impl ChangeSignal for Wake {
    fn notify(&self) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.changed.notify_all();
    }
}

impl StartupHandoff for StartupState {
    fn begin(&self, head: Arc<dyn RenderGeneration>, cancel: Arc<dyn ChangeCancellation>) -> bool {
        let mut state = self
            .wake
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state.started {
            return false;
        }
        state.started = true;
        state.running = true;
        state.head = Some(Arc::downgrade(&head));
        state.cancel = Some(cancel);
        true
    }
    fn selected(&self, key: BaseKey) {
        let mut state = self
            .wake
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.key = Some(key);
        self.wake.changed.notify_all();
    }
    fn complete(&self, ready: StartupReady) {
        let mut state = self
            .wake
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !state.rejected {
            state.ready = Some(ready);
        }
        self.wake.changed.notify_all();
    }
    fn finished(&self) {
        let mut state = self
            .wake
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.running = false;
        self.wake.changed.notify_all();
    }
    fn take(
        &self,
        key: &BaseKey,
        head: &Arc<dyn RenderGeneration>,
        cancel: &dyn ChangeCancellation,
    ) -> Result<Option<StartupReady>> {
        let head = Arc::downgrade(head);
        let signal: Arc<dyn ChangeSignal> = self.wake.clone();
        cancel.observe(Arc::downgrade(&signal));
        loop {
            let action = {
                let mut state = self
                    .wake
                    .state
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                if cancel.cancelled() {
                    return Err(Error::Cancelled);
                }
                let mismatch = state
                    .head
                    .as_ref()
                    .is_some_and(|origin| !origin.ptr_eq(&head))
                    || state.key.as_ref().is_some_and(|selected| selected != key);
                if mismatch && !state.rejected {
                    state.rejected = true;
                    Handoff::Cancel(state.cancel.clone(), state.ready.take())
                } else if !state.running {
                    let accepted = !state.rejected
                        && state.key.as_ref() == Some(key)
                        && state
                            .head
                            .as_ref()
                            .is_some_and(|origin| origin.ptr_eq(&head));
                    let ready = state.ready.take();
                    state.head = None;
                    state.cancel = None;
                    state.key = None;
                    Handoff::Ready(accepted, ready)
                } else {
                    let _state = self
                        .wake
                        .changed
                        .wait(state)
                        .unwrap_or_else(|error| error.into_inner());
                    Handoff::Waiting
                }
            };
            match action {
                Handoff::Cancel(obsolete, _discarded) => {
                    if let Some(obsolete) = obsolete {
                        obsolete.cancel();
                    }
                }
                Handoff::Ready(accepted, ready) => return Ok(if accepted { ready } else { None }),
                Handoff::Waiting => {}
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/serve_startup_base_tests.rs"]
mod serve_startup_base_tests;

#[cfg(test)]
#[path = "_tests_/serve_startup_wait_tests.rs"]
mod serve_startup_wait_tests;
