//! Completed current usage wakes preparation without a clock or render worker.

use std::sync::{Arc, Condvar, Mutex, Weak};

use crate::changes::ChangeCancellation;
use crate::changes_signal::{ChangeSignal, Signals};

/// The current usage pass that governs one head's historical comparison.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = UsageCompletionMock))]
pub trait UsageCompletion: Send + Sync {
    /// Whether every current view has settled.
    fn settled(&self) -> bool;
    /// Wait for current usage, returning false on classification cancellation.
    fn wait(&self, cancel: &dyn ChangeCancellation) -> bool;
    /// Wake admission when usage settles, including a late registration.
    fn observe(&self, signal: Weak<dyn ChangeSignal>);
}

/// Current usage has already settled for an ordinary classification.
pub struct CompletedUsage;
impl UsageCompletion for CompletedUsage {
    fn settled(&self) -> bool {
        true
    }
    fn wait(&self, cancel: &dyn ChangeCancellation) -> bool {
        !cancel.cancelled()
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        if let Some(signal) = signal.upgrade() {
            signal.notify();
        }
    }
}

#[derive(Default)]
pub(crate) struct UsageLatch {
    wake: Arc<Wake>,
    signals: Signals,
}

impl UsageLatch {
    pub(crate) fn complete(&self) {
        {
            let mut settled = self
                .wake
                .settled
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            *settled = true;
            self.wake.changed.notify_all();
        }
        self.signals.notify();
    }
}

impl UsageCompletion for UsageLatch {
    fn settled(&self) -> bool {
        *self
            .wake
            .settled
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }
    fn wait(&self, cancel: &dyn ChangeCancellation) -> bool {
        let signal: Arc<dyn ChangeSignal> = self.wake.clone();
        cancel.observe(Arc::downgrade(&signal));
        let mut settled = self
            .wake
            .settled
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while !*settled && !cancel.cancelled() {
            settled = self
                .wake
                .changed
                .wait(settled)
                .unwrap_or_else(|error| error.into_inner());
        }
        !cancel.cancelled()
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        self.signals.add(signal.clone());
        if self.settled()
            && let Some(signal) = signal.upgrade()
        {
            signal.notify();
        }
    }
}

#[derive(Default)]
struct Wake {
    settled: Mutex<bool>,
    changed: Condvar,
}
impl ChangeSignal for Wake {
    fn notify(&self) {
        let _settled = self
            .settled
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        self.changed.notify_all();
    }
}
