//! A separate sequence fence wakes early admission without taking the HTTP gate.

use std::sync::{Condvar, Mutex};

use mokly_server::changes_signal::ChangeSignal;
use mokly_sidecar::pool::ReturnWake;

#[cfg_attr(test, unimock::unimock(api = PreparationWakeMock))]
pub(super) trait PreparationWake: ChangeSignal + ReturnWake {
    fn version(&self) -> u64;
    fn wait(&self, version: u64);
    fn wake(&self);
}

#[derive(Default)]
pub(super) struct Wake {
    version: Mutex<u64>,
    changed: Condvar,
}

impl PreparationWake for Wake {
    fn version(&self) -> u64 {
        *self
            .version
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }
    fn wait(&self, version: u64) {
        let mut current = self
            .version
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while *current == version {
            current = self
                .changed
                .wait(current)
                .unwrap_or_else(|error| error.into_inner());
        }
    }
    fn wake(&self) {
        let mut version = self
            .version
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *version = version.wrapping_add(1);
        self.changed.notify_all();
    }
}

impl ChangeSignal for Wake {
    fn notify(&self) {
        self.wake();
    }
}
impl ReturnWake for Wake {
    fn notify(&self) {
        self.wake();
    }
}
