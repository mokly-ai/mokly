//! Limits for one authentication retention statement inside a transaction.

use std::time::Duration;

/// Row and statement-time bounds, applied locally to the current transaction.
#[derive(Clone, Copy, Debug)]
pub struct PruneBatch {
    /// Maximum rows to remove, capped at 1,000 by the store.
    pub limit: u32,
    /// Remaining statement allowance, capped at five seconds by the store.
    pub timeout: Duration,
}
