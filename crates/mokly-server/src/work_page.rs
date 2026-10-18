//! A page's replaceable preview queue retains one admission ticket.

use std::sync::atomic::AtomicU64;
use std::sync::{Arc, Mutex, Weak};

use tokio::sync::{Notify, OwnedSemaphorePermit, Semaphore};

/// Replace queued edits without consuming another global queue ticket.
pub(crate) struct Page {
    /// Serialize one page's active preview.
    pub(crate) gate: Arc<Semaphore>,
    /// Most recent admitted edit.
    pub(crate) next: AtomicU64,
    /// Wake an edit when a newer edit replaces it.
    pub(crate) changed: Notify,
    /// All queued replacements share this admission slot.
    pub(crate) queued: Mutex<Weak<OwnedSemaphorePermit>>,
}

impl Default for Page {
    fn default() -> Self {
        Self {
            gate: Arc::new(Semaphore::new(1)),
            next: AtomicU64::new(0),
            changed: Notify::new(),
            queued: Mutex::new(Weak::new()),
        }
    }
}
