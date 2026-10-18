//! A serialized capture can cancel its Git reads without retiring the pinned base.

use std::sync::{Arc, Mutex, Weak};

use mokly_server::changes::{CaptureLease, ChangeCancellation};
use mokly_server::changes_signal::ChangeSignal;

pub(super) trait CaptureScopes: ChangeCancellation {
    fn enter(&self, cancel: Arc<dyn ChangeCancellation>) -> Box<dyn CaptureLease>;
}

#[derive(Default)]
pub(super) struct CaptureCancellation {
    state: Arc<Mutex<State>>,
}
#[derive(Default)]
struct State {
    current: Option<Arc<dyn ChangeCancellation>>,
    signals: Vec<Weak<dyn ChangeSignal>>,
}
impl CaptureScopes for CaptureCancellation {
    fn enter(&self, cancel: Arc<dyn ChangeCancellation>) -> Box<dyn CaptureLease> {
        let signals = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.current = Some(cancel.clone());
            state.signals.retain(|signal| signal.strong_count() > 0);
            state.signals.clone()
        };
        for signal in signals {
            cancel.observe(signal);
        }
        Box::new(Lease {
            state: self.state.clone(),
        })
    }
}
impl ChangeCancellation for CaptureCancellation {
    fn cancel(&self) {
        let current = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .current
            .clone();
        if let Some(cancel) = current {
            cancel.cancel();
        }
    }
    fn cancelled(&self) -> bool {
        let current = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .current
            .clone();
        current.is_some_and(|cancel| cancel.cancelled())
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        let current = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.signals.retain(|signal| signal.strong_count() > 0);
            if !state
                .signals
                .iter()
                .any(|existing| existing.ptr_eq(&signal))
            {
                state.signals.push(signal.clone());
            }
            state.current.clone()
        };
        if let Some(cancel) = current {
            cancel.observe(signal);
        }
    }
}
struct Lease {
    state: Arc<Mutex<State>>,
}
impl CaptureLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .current
            .take();
    }
}

#[cfg(test)]
#[path = "_tests_/serve_capture_cancel_tests.rs"]
mod serve_capture_cancel_tests;
