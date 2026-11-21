//! Cold historical discovery waits for a completed head startup milestone.

use std::sync::{Arc, Condvar, Mutex, Weak};

use mokly_compare::error::{Error, Result};
use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;

use crate::changes_source_admission::{SourceAdmission, SourceCache};

const WAIT_FOR_READY: bool = true;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
/// The startup milestone that permits cold historical discovery.
pub enum SourceBound {
    /// Prefer this attempt's completed head bundle, with readiness as fallback.
    HeadBundleOrReady,
    /// Start only after successful Serve readiness.
    Ready,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
/// One head preparation attempt that excludes superseded bundle completions.
pub struct SourceAttempt(pub(super) u64);

impl SourceBound {
    pub(super) fn selected() -> Self {
        if WAIT_FOR_READY {
            Self::Ready
        } else {
            Self::HeadBundleOrReady
        }
    }
}

#[cfg_attr(test, unimock::unimock(api = SourceStartsMock))]
pub(super) trait SourceStarts: Send + Sync {
    fn begin(&self) -> SourceAttempt;
    fn current(&self) -> SourceAttempt;
    fn bundle_finished(&self, attempt: SourceAttempt);
    fn ready(&self);
    fn released(&self, attempt: SourceAttempt, bound: SourceBound) -> bool;
    fn observe(&self, signal: Weak<dyn ChangeSignal>);
}

#[derive(Default)]
struct State {
    attempt: SourceAttempt,
    bundle: bool,
    ready: bool,
    signals: Vec<Weak<dyn ChangeSignal>>,
}

#[derive(Default)]
pub(super) struct StartupSources(Mutex<State>);

impl SourceStarts for StartupSources {
    fn begin(&self) -> SourceAttempt {
        let mut state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        state.attempt.0 = state.attempt.0.saturating_add(1);
        state.bundle = false;
        state.attempt
    }
    fn current(&self) -> SourceAttempt {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .attempt
    }
    fn bundle_finished(&self, attempt: SourceAttempt) {
        {
            let mut state = self.0.lock().unwrap_or_else(|error| error.into_inner());
            if state.attempt != attempt {
                return;
            }
            state.bundle = true;
        }
        self.notify();
    }
    fn ready(&self) {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .ready = true;
        self.notify();
    }
    fn released(&self, attempt: SourceAttempt, bound: SourceBound) -> bool {
        let state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        state.ready
            || state.attempt == attempt && bound == SourceBound::HeadBundleOrReady && state.bundle
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
    bound: SourceBound,
    attempt: SourceAttempt,
    state: Mutex<()>,
    changed: Condvar,
}

impl SourceWait {
    pub(super) fn shared(
        starts: Arc<dyn SourceStarts>,
        cancel: Arc<dyn ChangeCancellation>,
        bound: SourceBound,
        attempt: SourceAttempt,
    ) -> Arc<dyn SourceAdmission> {
        let wait = Arc::new(Self {
            starts,
            cancel,
            bound,
            attempt,
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
            while !self.starts.released(self.attempt, self.bound) && !self.cancel.cancelled() {
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
