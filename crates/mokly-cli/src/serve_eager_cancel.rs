//! A pending origin adds its classification reader without detaching from its owner.

use std::sync::{Arc, Mutex, Weak};

use mokly_server::changes::{ChangeCancellation, ChangeCommit, ChangeToken};
use mokly_server::changes_signal::ChangeSignal;

pub(super) trait OriginScope: ChangeCancellation {
    fn reader(&self, reader: Arc<dyn ChangeCancellation>);
    fn reader_current(&self) -> bool;
    fn operation(&self, operation: Arc<dyn ChangeCancellation>);
}

#[derive(Default)]
pub(super) struct OriginCancellation {
    owner: ChangeToken,
    reader: Mutex<Option<Arc<dyn ChangeCancellation>>>,
    operation: Mutex<Option<Arc<dyn ChangeCancellation>>>,
    signals: Mutex<Vec<Weak<dyn ChangeSignal>>>,
}

impl OriginScope for OriginCancellation {
    fn operation(&self, operation: Arc<dyn ChangeCancellation>) {
        *self
            .operation
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(operation.clone());
        let signals = self
            .signals
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        for signal in signals {
            operation.observe(signal);
        }
    }
    fn reader_current(&self) -> bool {
        self.reader
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .is_some_and(|reader| !reader.cancelled())
    }
    fn reader(&self, reader: Arc<dyn ChangeCancellation>) {
        *self
            .reader
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(reader.clone());
        let signals = self
            .signals
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        for signal in signals {
            reader.observe(signal);
        }
    }
}

impl ChangeCancellation for OriginCancellation {
    fn commit(&self, publication: &dyn ChangeCommit) -> bool {
        self.owner.commit(&OwnerCommit {
            scope: self,
            publication,
        })
    }
    fn cancel(&self) {
        self.owner.cancel();
    }
    fn cancelled(&self) -> bool {
        self.owner.cancelled()
            || self
                .reader
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .as_ref()
                .is_some_and(|reader| reader.cancelled())
            || self
                .operation
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .as_ref()
                .is_some_and(|operation| operation.cancelled())
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        {
            let mut signals = self
                .signals
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            signals.retain(|signal| signal.strong_count() > 0);
            if !signals.iter().any(|current| current.ptr_eq(&signal)) {
                signals.push(signal.clone());
            }
        }
        self.owner.observe(signal.clone());
        let reader = self
            .reader
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        if let Some(reader) = reader {
            reader.observe(signal.clone());
        }
        let operation = self
            .operation
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        if let Some(operation) = operation {
            operation.observe(signal);
        }
    }
}

struct OwnerCommit<'a> {
    scope: &'a OriginCancellation,
    publication: &'a dyn ChangeCommit,
}

impl ChangeCommit for OwnerCommit<'_> {
    fn apply(&self) -> bool {
        !self.scope.cancelled() && self.publication.apply()
    }
}

#[cfg(test)]
#[path = "_tests_/eager_capture_lifetime_tests.rs"]
mod eager_capture_lifetime_tests;
