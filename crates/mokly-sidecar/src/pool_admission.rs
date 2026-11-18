//! Shared prospective capacity and memory admission for lazy pool slots.

use std::sync::Arc;

use crate::error::{Error, Result};
use crate::host_memory::HostMemory;
use crate::memory_schedule::MEMORY_LIMIT;
use crate::pool::Pool;
use crate::pool_claim::{self, CallClaim};
use crate::pool_state::State;

const HOST_SPARE: u64 = 1024 * 1024 * 1024;

pub(super) struct Admission {
    pub(super) capacity: usize,
    pub(super) slot_limit: usize,
}

/// Prospective concurrency, including already reserved worker slots.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CapacityMock))]
pub trait PoolCapacity: Send + Sync {
    /// Read the current memory-permitted capacity without reserving a slot.
    fn capacity(&self) -> usize;
    /// Atomically hold capacity for one call without creating a worker slot.
    /// A temporary shortage returns `Ok(None)`; a stopped pool returns `Cancelled`.
    fn try_claim(&self) -> Result<Option<CallClaim>>;
}

impl Pool {
    /// Check memory before default growth while retaining the CPU upper bound.
    pub fn with_memory_admission(mut self, memory: Arc<dyn HostMemory>) -> Self {
        self.admission = Some(memory);
        self
    }

    /// Slot indices include permanent retirements; capacity includes usable slots only.
    pub(super) fn admission(&self, state: &State) -> Admission {
        let maximum = self.options.size.get();
        let Some(memory) = &self.admission else {
            return Admission {
                capacity: maximum,
                slot_limit: maximum,
            };
        };
        let reserved = state.slots.len() - state.retired.len();
        let claimed = pool_claim::growth(state);
        let remaining = maximum.saturating_sub(state.slots.len() + claimed);
        if remaining == 0 || state.stopped {
            return Admission {
                capacity: (reserved + claimed).max(1),
                slot_limit: state.slots.len(),
            };
        }
        let unused = (0..state.slots.len())
            .filter(|index| !state.retired.contains(index))
            .map(|index| {
                let resident = state
                    .controls
                    .get(&index)
                    .and_then(|control| control.resident_bytes().ok())
                    .unwrap_or(0);
                MEMORY_LIMIT.saturating_sub(resident)
            })
            .fold(0, u64::saturating_add)
            .saturating_add(
                u64::try_from(claimed)
                    .unwrap_or(u64::MAX)
                    .saturating_mul(MEMORY_LIMIT),
            );
        let growth = memory.headroom_bytes().map_or(0, |headroom| {
            headroom.saturating_sub(unused).saturating_sub(HOST_SPARE) / MEMORY_LIMIT
        });
        let growth = remaining
            .min(usize::try_from(growth).unwrap_or(usize::MAX))
            .max(usize::from(reserved + claimed == 0));
        Admission {
            capacity: reserved + claimed + growth,
            slot_limit: state.slots.len() + growth,
        }
    }
}

impl PoolCapacity for Pool {
    fn capacity(&self) -> usize {
        self.admission(&self.lock()).capacity
    }
    fn try_claim(&self) -> Result<Option<CallClaim>> {
        let mut state = self.lock();
        if state.stopped {
            return Err(Error::Cancelled);
        }
        if state.claims.len() >= self.admission(&state).capacity {
            return Ok(None);
        }
        let reserved = state.slots.len() - state.retired.len();
        let growth = if self.admission.is_some() {
            (state.claims.len() + 1).saturating_sub(reserved + pool_claim::growth(&state))
        } else {
            0
        };
        let id = state.next_claim;
        state.next_claim += 1;
        state.claims.insert(id, growth);
        Ok(Some(CallClaim::new(&self.state, &self.ready, id)))
    }
}

#[cfg(test)]
#[path = "_tests_/admission/mod.rs"]
mod admission_tests;
