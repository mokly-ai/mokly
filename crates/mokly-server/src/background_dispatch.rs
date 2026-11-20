//! Small window signal shared with a Stage only after an eligible real miss.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock, Weak};
use std::task::Waker;

use crate::background_stage::{Stage, Stages};

/// Window ownership before a physical view hands off or ends.
pub struct Dispatch {
    pub(crate) stages: Arc<Stages>,
    pub(crate) stage: OnceLock<Weak<Stage>>,
    wake: Mutex<Option<Waker>>,
    pub(crate) queue_bytes: AtomicUsize,
}

impl Dispatch {
    /// Keep one lookup window place until the view hands off or ends.
    pub fn new(stages: Arc<Stages>) -> Arc<Self> {
        Arc::new(Self {
            stages,
            stage: OnceLock::new(),
            wake: Mutex::new(None),
            queue_bytes: AtomicUsize::new(0),
        })
    }

    pub(crate) fn handed_off(&self) -> bool {
        self.stage
            .get()
            .and_then(Weak::upgrade)
            .is_some_and(|stage| stage.handed_off())
    }

    pub(crate) fn handoff(&self) {
        if let Some(wake) = self
            .wake
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
        {
            wake.wake();
        }
    }

    pub(crate) fn register(&self, wake: &Waker) {
        *self.wake.lock().unwrap_or_else(|error| error.into_inner()) = Some(wake.clone());
    }

    pub(crate) fn queue_bytes(&self, bytes: usize) {
        self.queue_bytes.store(bytes, Ordering::SeqCst);
    }
}
