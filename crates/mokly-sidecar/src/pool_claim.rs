//! Temporary admission for one Serve call before it starts a new worker slot.

use std::sync::{Arc, Condvar, Mutex, Weak};

use crate::pool_cleanup;
use crate::pool_state::State;

/// A call-scoped hold that becomes durable only when a new worker slot starts.
pub struct CallClaim {
    owner: Option<Owner>,
}

struct Owner {
    state: Weak<Mutex<State>>,
    ready: Weak<Condvar>,
    id: u64,
}

impl CallClaim {
    /// Construct a claim for an exact capacity supplied by another owner.
    pub fn fixed() -> Self {
        Self { owner: None }
    }

    pub(super) fn new(state: &Arc<Mutex<State>>, ready: &Arc<Condvar>, id: u64) -> Self {
        Self {
            owner: Some(Owner {
                state: Arc::downgrade(state),
                ready: Arc::downgrade(ready),
                id,
            }),
        }
    }

    pub(super) fn id(&self, state: &Arc<Mutex<State>>) -> Option<u64> {
        self.owner
            .as_ref()
            .filter(|owner| owner.state.ptr_eq(&Arc::downgrade(state)))
            .map(|owner| owner.id)
    }
}

impl Drop for CallClaim {
    fn drop(&mut self) {
        if let Some(owner) = &self.owner
            && let Some(state) = owner.state.upgrade()
        {
            let mut state = pool_cleanup::lock(&state);
            if let Some(reserved) = state.eager.remove(&owner.id)
                && !reserved.taken
            {
                if reserved.fresh {
                    state.free.insert(reserved.index);
                    if let Some(growth) = reserved
                        .source_claim
                        .and_then(|id| state.claims.get_mut(&id))
                    {
                        *growth += 1;
                    }
                } else {
                    state.available.push_back(reserved.index);
                }
            }
            state.claims.remove(&owner.id);
            state.head.notify();
            if let Some(ready) = owner.ready.upgrade() {
                ready.notify_all();
            }
        }
    }
}

pub(super) fn growth(state: &State) -> usize {
    state.claims.values().sum()
}

/// Return the source claim so an unused start can restore its borrowed growth budget.
pub(super) fn consume(state: &mut State, claim: Option<u64>) -> Option<u64> {
    let claim = claim.filter(|id| state.claims.contains_key(id))?;
    let selected = state
        .claims
        .get(&claim)
        .filter(|growth| **growth > 0)
        .map(|_| claim)
        .or_else(|| {
            state
                .claims
                .iter()
                .find(|(_, growth)| **growth > 0)
                .map(|(id, _)| *id)
        });
    if let Some(growth) = selected.and_then(|id| state.claims.get_mut(&id)) {
        *growth -= 1;
    }
    selected
}
