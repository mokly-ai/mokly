//! Injected filesystem observation and a lossless path-coalesced inbox.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use async_trait::async_trait;
use tokio::sync::Notify;

use crate::error::{Error, Result};
use crate::event::Event;
use crate::plan::Plan;

/// An attached observer owns every native watch until close or drop.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ObserverMock))]
#[async_trait]
pub trait Observer: Send + Sync {
    /// Attach a replacement plan before the caller adopts its catalogue.
    fn replace(&self, plan: &Plan) -> Result<()>;
    /// Attach non-denied directories created under the active roots.
    fn rescan(&self, plan: &Plan) -> Result<()>;
    /// Whether this observer already watches every directory that the roots of `plan`
    /// need. A failed directory walk and a closed observer report `false`.
    fn covers(&self, plan: &Plan) -> bool;
    /// Whether this observer watches `directory` itself, so a change of a direct child
    /// produces an event. A closed observer watches nothing.
    fn observes(&self, directory: &Path) -> bool;
    /// Wait for at least one pending event without consuming it.
    async fn changed(&self);
    /// Drain the latest descriptor per path and each observer error.
    fn take(&self) -> Vec<Result<Event>>;
    /// Preserve buffered notifications while a ready candidate replaces its predecessor.
    fn replay(&self, events: Vec<Result<Event>>);
    /// Stop observation and discard pending notifications.
    fn close(&self);
}

#[derive(Default)]
pub(crate) struct Inbox {
    events: Mutex<BTreeMap<PathBuf, Event>>,
    errors: Mutex<Vec<Error>>,
    ready: Notify,
}

impl Inbox {
    pub(crate) fn send(&self, event: Result<Event>) {
        match event {
            Ok(event) => {
                self.events
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert(event.path.clone(), event);
            }
            Err(error) => self
                .errors
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .push(error),
        }
        self.ready.notify_one();
    }
    pub(crate) async fn changed(&self) {
        let ready = self.ready.notified();
        if self
            .events
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .is_empty()
            && self
                .errors
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .is_empty()
        {
            ready.await;
        }
    }
    pub(crate) fn take(&self) -> Vec<Result<Event>> {
        let events = std::mem::take(&mut *self.events.lock().unwrap_or_else(|e| e.into_inner()));
        let errors = std::mem::take(&mut *self.errors.lock().unwrap_or_else(|e| e.into_inner()));
        events
            .into_values()
            .map(Ok)
            .chain(errors.into_iter().map(Err))
            .collect()
    }
}
