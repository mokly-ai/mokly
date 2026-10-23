//! Scoped requests share a key's lock and remove metadata after the final lease.

use std::collections::BTreeMap;
use std::ops::Deref;
use std::sync::{Arc, Mutex};

use crate::key::NodeKey;

/// Per-owner synchronization for active requests, without retaining their results.
pub(crate) trait Requests: Send + Sync {
    /// Register one active request before it waits for the key's lock.
    fn acquire(&self, key: &NodeKey) -> Request<'_>;
    /// Observe registered keys in deterministic cleanup tests.
    #[cfg(test)]
    fn len(&self) -> usize;
    /// Whether every request has released its registry metadata.
    #[cfg(test)]
    fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

struct Slot {
    mutex: Arc<Mutex<()>>,
    users: usize,
}

/// An independent registry for one generation or fragment adapter.
#[derive(Default)]
pub(crate) struct MemoryRequests {
    entries: Mutex<BTreeMap<NodeKey, Slot>>,
}

/// A request owns its registration until its scope ends, including error returns.
pub(crate) struct Request<'a> {
    entries: &'a Mutex<BTreeMap<NodeKey, Slot>>,
    key: NodeKey,
    mutex: Arc<Mutex<()>>,
}

impl Requests for MemoryRequests {
    fn acquire(&self, key: &NodeKey) -> Request<'_> {
        let mutex = {
            let mut entries = self
                .entries
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            let slot = entries.entry(key.clone()).or_insert_with(|| Slot {
                mutex: Arc::new(Mutex::new(())),
                users: 0,
            });
            slot.users += 1;
            slot.mutex.clone()
        };
        Request {
            entries: &self.entries,
            key: key.clone(),
            mutex,
        }
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.entries
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .len()
    }
}

impl Deref for Request<'_> {
    type Target = Mutex<()>;

    fn deref(&self) -> &Self::Target {
        &self.mutex
    }
}

impl Drop for Request<'_> {
    fn drop(&mut self) {
        let mut entries = self
            .entries
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(slot) = entries.get_mut(&self.key) {
            slot.users = slot.users.saturating_sub(1);
            if slot.users == 0 {
                entries.remove(&self.key);
            }
        }
    }
}

#[cfg(test)]
impl Request<'_> {
    /// Keep a handle alive to model field drops after concurrent request cleanup.
    pub(crate) fn handle(&self) -> Arc<Mutex<()>> {
        self.mutex.clone()
    }
}
