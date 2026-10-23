//! Foreground admission keeps background work out of the worker queue.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use tokio::sync::Notify;

use crate::foreground::{Foreground, ForegroundLease};

#[derive(Default)]
pub(crate) struct Priority {
    foreground: AtomicUsize,
    pub(crate) changed: Notify,
    shared: Option<Arc<dyn Foreground>>,
}

impl Priority {
    pub(crate) fn new(shared: Arc<dyn Foreground>) -> Self {
        Self {
            shared: Some(shared),
            ..Self::default()
        }
    }

    pub(crate) fn enter(self: &Arc<Self>, foreground: bool) -> Guard {
        if foreground {
            self.foreground.fetch_add(1, Ordering::SeqCst);
        }
        Guard {
            priority: self.clone(),
            foreground,
            _shared: foreground
                .then(|| self.shared.as_ref().map(|shared| shared.enter()))
                .flatten(),
        }
    }
    pub(crate) fn idle(&self) -> bool {
        self.foreground.load(Ordering::SeqCst) == 0
    }
}

pub(crate) struct Guard {
    priority: Arc<Priority>,
    foreground: bool,
    _shared: Option<Box<dyn ForegroundLease>>,
}
impl Drop for Guard {
    fn drop(&mut self) {
        if self.foreground {
            self.priority.foreground.fetch_sub(1, Ordering::SeqCst);
        }
        self.priority.changed.notify_waiters();
    }
}
