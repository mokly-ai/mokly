//! Lock-free weighted accounting with shared drop-based release.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use mkc_upload_memory_interface::budget::{
    Error, Result, UploadMemoryBudget, UploadMemoryReservation,
};

/// One nonblocking byte budget shared across an API process.
pub struct ProcessUploadMemoryBudget {
    state: Arc<State>,
}

struct State {
    capacity: u64,
    held: AtomicU64,
}

struct Reservation {
    state: Arc<State>,
    bytes: u64,
}

impl ProcessUploadMemoryBudget {
    /// Create a budget with the exact configured byte capacity.
    pub fn new(capacity: u64) -> Self {
        Self {
            state: Arc::new(State {
                capacity,
                held: AtomicU64::new(0),
            }),
        }
    }
}

impl UploadMemoryReservation for Reservation {}

impl Drop for Reservation {
    fn drop(&mut self) {
        self.state.held.fetch_sub(self.bytes, Ordering::AcqRel);
    }
}

impl UploadMemoryBudget for ProcessUploadMemoryBudget {
    fn reserve(&self, bytes: u64) -> Result<Arc<dyn UploadMemoryReservation>> {
        let mut held = self.state.held.load(Ordering::Acquire);
        loop {
            if bytes > self.state.capacity.saturating_sub(held) {
                return Err(Error::Exhausted {
                    requested: bytes,
                    capacity: self.state.capacity,
                });
            }
            match self.state.held.compare_exchange_weak(
                held,
                held + bytes,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => {
                    return Ok(Arc::new(Reservation {
                        state: self.state.clone(),
                        bytes,
                    }));
                }
                Err(observed) => held = observed,
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/budget_tests.rs"]
mod budget_tests;
