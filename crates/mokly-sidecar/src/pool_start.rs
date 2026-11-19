//! New indexes hold admission until a real process starts or unused ownership ends.

use std::sync::{Arc, Condvar, Mutex};

use crate::pool::Pool;
use crate::pool_cleanup;
use crate::pool_state::State;

/// Only newly allocated indexes get this owner; existing reservations never roll back.
pub(super) struct StartLease {
    state: Arc<Mutex<State>>,
    ready: Arc<Condvar>,
    index: usize,
    source_claim: Option<u64>,
    committed: bool,
}

impl StartLease {
    pub(super) fn new(pool: &Pool, index: usize, source_claim: Option<u64>) -> Self {
        Self {
            state: Arc::clone(&pool.state),
            ready: Arc::clone(&pool.ready),
            index,
            source_claim,
            committed: false,
        }
    }

    /// A real start retains its reservation even when setup or hello fails.
    pub(super) fn commit(&mut self) {
        self.committed = true;
    }

    /// Drop unused ownership before ordinary release can publish an available index.
    pub(super) fn rollback(self) -> bool {
        !self.committed
    }
}

impl Drop for StartLease {
    fn drop(&mut self) {
        if self.committed {
            return;
        }
        let mut state = pool_cleanup::lock(&self.state);
        state.available.retain(|index| *index != self.index);
        state
            .affinity
            .retain(|_, affinity| affinity.index != self.index);
        state.memory.remove(&self.index);
        state.replacement_reasons.remove(&self.index);
        state.free.insert(self.index);
        if let Some(growth) = self.source_claim.and_then(|id| state.claims.get_mut(&id)) {
            *growth += 1;
        }
        state.head.notify();
        self.ready.notify_all();
    }
}
