//! Recorded test calls remain readable after a failed assertion poisons their mutex.

use std::sync::{Mutex, MutexGuard, PoisonError};

/// Keep recorded calls available after a panic while their lock was held.
pub(crate) fn lock_calls<T>(calls: &Mutex<T>) -> MutexGuard<'_, T> {
    calls.lock().unwrap_or_else(PoisonError::into_inner)
}
