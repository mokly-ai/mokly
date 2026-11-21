//! Eager calls switch to ordinary base admission when classification adopts their owner.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, Weak};

use mokly_server::changes_signal::ChangeSignal;

pub trait EagerAdmission: Send + Sync {
    fn adopted(&self) -> bool;
    fn allowed(&self, capacity: usize) -> bool;
    fn dispatched(&self);
    fn adopt(&self);
    fn observe(&self, signal: Weak<dyn ChangeSignal>);
}

#[derive(Default)]
pub(super) struct PreparationAdmission {
    adopted: AtomicBool,
    dispatched: AtomicBool,
    signals: Mutex<Vec<Weak<dyn ChangeSignal>>>,
}

impl PreparationAdmission {
    fn notify(&self) {
        let signals: Vec<_> = self
            .signals
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

impl EagerAdmission for PreparationAdmission {
    fn adopted(&self) -> bool {
        self.adopted.load(Ordering::Acquire)
    }
    fn allowed(&self, capacity: usize) -> bool {
        capacity > 1 && (capacity > 3 || self.dispatched.load(Ordering::Acquire))
    }
    fn dispatched(&self) {
        self.dispatched.store(true, Ordering::Release);
        self.notify();
    }
    fn adopt(&self) {
        self.adopted.store(true, Ordering::Release);
        self.notify();
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        let mut signals = self
            .signals
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        signals.retain(|signal| signal.strong_count() > 0);
        if !signals.iter().any(|existing| existing.ptr_eq(&signal)) {
            signals.push(signal);
        }
    }
}
