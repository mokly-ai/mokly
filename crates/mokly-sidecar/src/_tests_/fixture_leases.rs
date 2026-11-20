//! Explicit leases leave one fixture slot idle for requests through the pool.

use std::collections::VecDeque;

use crate::methods::{Call, Generation};
use crate::pool::Pool;
use crate::pool_start::StartLease;
use crate::pool_state::Slot;

struct HeldLease {
    index: usize,
    slot: Option<Slot>,
    start: Option<StartLease>,
}

/// Keep other fixture slots busy until their leases return through cleanup.
pub(super) struct FixtureLeases<'pool> {
    pool: &'pool Pool,
    held: Vec<HeldLease>,
}

impl<'pool> FixtureLeases<'pool> {
    /// Acquire each idle slot separately, then return the named request slot.
    pub(super) fn only(pool: &'pool Pool, idle: usize) -> Self {
        let available = {
            let mut state = pool.lock();
            assert!(state.available.contains(&idle));
            std::mem::take(&mut state.available)
        };
        let mut leases = Self {
            pool,
            held: Vec::new(),
        };
        for index in available {
            pool.lock().available.push_back(index);
            leases.hold(index);
        }
        leases.release(idle);
        leases
    }

    /// Hold the sole idle slot without sending a worker request.
    pub(super) fn hold(&mut self, index: usize) {
        assert_eq!(self.pool.lock().available, VecDeque::from([index]));
        let (acquired, slot, start) = self
            .pool
            .acquire(
                &Call::Dispose(Generation {
                    generation: String::new(),
                }),
                None,
                None,
            )
            .unwrap();
        assert_eq!(acquired, index);
        self.held.push(HeldLease { index, slot, start });
    }

    /// Return a held slot through the pool's normal cleanup path.
    pub(super) fn release(&mut self, index: usize) {
        let position = self
            .held
            .iter()
            .position(|lease| lease.index == index)
            .unwrap();
        let lease = self.held.remove(position);
        self.pool.release(lease.index, lease.slot, lease.start);
    }
}

impl Drop for FixtureLeases<'_> {
    fn drop(&mut self) {
        for lease in self.held.drain(..) {
            self.pool.release(lease.index, lease.slot, lease.start);
        }
    }
}
