//! Weak cancellation listeners wake admission without polling a real clock.

use std::sync::{Mutex, Weak};

/// A blocked runtime queue that must recheck generation cancellation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChangeSignalMock))]
pub trait ChangeSignal: Send + Sync {
    /// Wake pending admission; the caller still checks its cancellation token.
    fn notify(&self);
}

impl std::fmt::Debug for dyn ChangeSignal + '_ {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("ChangeSignal")
    }
}

#[derive(Default)]
/// Weak listeners do not extend the lifetime of a runtime queue.
pub(crate) struct Signals(Mutex<Vec<Weak<dyn ChangeSignal>>>);

impl Signals {
    /// Retain one subscription for each live queue.
    pub(crate) fn add(&self, signal: Weak<dyn ChangeSignal>) {
        let mut signals = self.0.lock().unwrap_or_else(|error| error.into_inner());
        signals.retain(|signal| signal.strong_count() > 0);
        if !signals.iter().any(|existing| existing.ptr_eq(&signal)) {
            signals.push(signal);
        }
    }

    /// Call listeners outside the subscription lock.
    pub(crate) fn notify(&self) {
        let signals: Vec<_> = self
            .0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
            .filter_map(Weak::upgrade)
            .collect();
        for signal in signals {
            signal.notify();
        }
    }
}
