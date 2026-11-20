//! Injected delay and entropy for transaction retries.

use std::thread;
use std::time::Duration;

use mkc_store_interface::error::{ErrorResultExt, Result};

/// Impure inputs used exclusively by database retry policy.
#[unimock::unimock(api = RuntimeMock)]
pub trait Runtime: Send + Sync {
    /// Uniform jitter from zero through the supplied maximum.
    fn jitter(&self, maximum: Duration) -> Result<Duration>;
    /// Wait on the blocking database worker.
    fn sleep(&self, delay: Duration);
}

/// Native blocking-worker runtime.
pub struct SystemRuntime;

impl Runtime for SystemRuntime {
    fn jitter(&self, maximum: Duration) -> Result<Duration> {
        let mut bytes = [0; 8];
        getrandom::fill(&mut bytes).context("generate retry jitter")?;
        let bound = maximum.as_millis() as u64 + 1;
        Ok(Duration::from_millis(u64::from_ne_bytes(bytes) % bound))
    }

    fn sleep(&self, delay: Duration) {
        thread::sleep(delay);
    }
}
