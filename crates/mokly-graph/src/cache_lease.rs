//! Transient render payloads share the retained cache budget.

use std::sync::{Arc, Mutex};

use crate::cache_state::State;

/// A retained-byte reservation released when its owner ends.
pub trait ByteLease: Send + Sync {}

pub(crate) struct Reservation {
    pub(crate) owner: Arc<Mutex<State>>,
    pub(crate) bytes: usize,
}

impl ByteLease for Reservation {}

impl Drop for Reservation {
    fn drop(&mut self) {
        let mut state = self.owner.lock().unwrap_or_else(|error| error.into_inner());
        state.leased -= self.bytes;
        state.full.bound = state.available() - state.compact.bytes;
    }
}
