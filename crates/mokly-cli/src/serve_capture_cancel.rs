//! A serialized capture can cancel its Git reads without retiring the pinned base.

use std::sync::{Arc, Mutex};

use mokly_server::changes::{CaptureLease, ChangeCancellation};

pub(super) trait CaptureScopes: ChangeCancellation {
    fn enter(&self, cancel: Arc<dyn ChangeCancellation>) -> Box<dyn CaptureLease>;
}

#[derive(Default)]
pub(super) struct CaptureCancellation {
    current: Arc<Mutex<Option<Arc<dyn ChangeCancellation>>>>,
}
impl CaptureScopes for CaptureCancellation {
    fn enter(&self, cancel: Arc<dyn ChangeCancellation>) -> Box<dyn CaptureLease> {
        *self
            .current
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(cancel);
        Box::new(Lease {
            current: self.current.clone(),
        })
    }
}
impl ChangeCancellation for CaptureCancellation {
    fn cancel(&self) {
        if let Some(cancel) = self
            .current
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
        {
            cancel.cancel();
        }
    }
    fn cancelled(&self) -> bool {
        self.current
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .is_some_and(|cancel| cancel.cancelled())
    }
}
struct Lease {
    current: Arc<Mutex<Option<Arc<dyn ChangeCancellation>>>>,
}
impl CaptureLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.current
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
    }
}

#[cfg(test)]
#[path = "_tests_/serve_capture_cancel_tests.rs"]
mod serve_capture_cancel_tests;
