//! Cold historical discovery waits for the first successful Serve readiness.

use std::sync::{Arc, Condvar, Mutex, Weak};

use mokly_compare::error::{Error, Result};
use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;

use crate::changes_source_admission::{SourceAdmission, SourceCache};

#[cfg_attr(test, unimock::unimock(api = SourceStartsMock))]
pub(super) trait SourceStarts: Send + Sync {
    fn ready(&self);
    fn released(&self) -> bool;
    fn observe(&self, signal: Weak<dyn ChangeSignal>);
}

#[derive(Default)]
struct State {
    ready: bool,
    signals: Vec<Weak<dyn ChangeSignal>>,
}

#[derive(Default)]
pub(super) struct StartupSources(Mutex<State>);

impl SourceStarts for StartupSources {
    fn ready(&self) {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .ready = true;
        self.notify();
    }
    fn released(&self) -> bool {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .ready
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        let mut state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        state.signals.retain(|signal| signal.strong_count() > 0);
        if !state.signals.iter().any(|current| current.ptr_eq(&signal)) {
            state.signals.push(signal);
        }
    }
}

impl StartupSources {
    fn notify(&self) {
        let signals: Vec<_> = self
            .0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .signals
            .iter()
            .filter_map(Weak::upgrade)
            .collect();
        for signal in signals {
            signal.notify();
        }
    }
}

pub(super) struct SourceWait {
    starts: Arc<dyn SourceStarts>,
    cancel: Arc<dyn ChangeCancellation>,
    state: Mutex<()>,
    changed: Condvar,
}

impl SourceWait {
    pub(super) fn shared(
        starts: Arc<dyn SourceStarts>,
        cancel: Arc<dyn ChangeCancellation>,
    ) -> Arc<dyn SourceAdmission> {
        let wait = Arc::new(Self {
            starts,
            cancel,
            state: Mutex::new(()),
            changed: Condvar::new(),
        });
        let signal: Arc<dyn ChangeSignal> = wait.clone();
        wait.starts.observe(Arc::downgrade(&signal));
        wait.cancel.observe(Arc::downgrade(&signal));
        wait
    }
}

impl SourceAdmission for SourceWait {
    fn enter(&self, cache: SourceCache) -> Result<()> {
        if cache == SourceCache::Unleased {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            while !self.starts.released() && !self.cancel.cancelled() {
                state = self
                    .changed
                    .wait(state)
                    .unwrap_or_else(|error| error.into_inner());
            }
        }
        if self.cancel.cancelled() {
            Err(Error::Cancelled)
        } else {
            Ok(())
        }
    }
}

impl ChangeSignal for SourceWait {
    fn notify(&self) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.changed.notify_all();
    }
}

#[cfg(test)]
#[path = "_tests_/eager_cold_gate_tests.rs"]
mod eager_cold_gate_tests;
