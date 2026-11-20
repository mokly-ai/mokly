//! Nonblocking weighted admission and shared reservation lifetimes.

use std::result;
use std::sync::Arc;

use thiserror::Error;

/// A held byte reservation released by its concrete implementation on drop.
pub trait UploadMemoryReservation: Send + Sync {}

/// Process-wide byte admission shared by every upload body path.
#[unimock::unimock(api = UploadMemoryBudgetMock)]
pub trait UploadMemoryBudget: Send + Sync {
    /// Reserve `bytes` immediately or report typed capacity exhaustion.
    fn reserve(&self, bytes: u64) -> Result<Arc<dyn UploadMemoryReservation>>;
}

/// Upload-memory admission failures callers may translate to retryable errors.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum Error {
    /// The requested bytes do not fit while existing reservations are held.
    #[error("[mkc-upload-memory-interface/budget] {requested} bytes exceed capacity {capacity}")]
    Exhausted {
        /// Bytes requested by this body or archive entry.
        requested: u64,
        /// Configured process-wide upload capacity.
        capacity: u64,
    },
}

/// Upload-memory admission result.
pub type Result<T> = result::Result<T, Error>;
