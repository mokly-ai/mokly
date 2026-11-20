//! Retry failed seed requests within one injected two-minute budget per request.

use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use mkc_file_store_interface::error::Result;
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;

use super::timing::{Clock, Sleeper};

pub(super) struct RetryingSeedStore {
    pub(super) inner: Arc<dyn SeedStore>,
    pub(super) clock: Arc<dyn Clock>,
    pub(super) sleeper: Arc<dyn Sleeper>,
}

impl SeedStore for RetryingSeedStore {
    fn put(&self, name: &SeedName, bytes: Bytes) -> Result<()> {
        self.retry(name, || self.inner.put(name, bytes.clone()))
    }

    fn get(&self, name: &SeedName, max_bytes: u64) -> Result<Option<Vec<u8>>> {
        self.retry(name, || self.inner.get(name, max_bytes))
    }
}

impl RetryingSeedStore {
    fn retry<T>(&self, name: &SeedName, mut operation: impl FnMut() -> Result<T>) -> Result<T> {
        let started = self.clock.now();
        loop {
            match operation() {
                Ok(value) => return Ok(value),
                Err(error) => {
                    let elapsed = self.clock.now().saturating_sub(started);
                    let remaining = Duration::from_secs(120).saturating_sub(elapsed);
                    if remaining.is_zero() {
                        return Err(error);
                    }
                    tracing::warn!(object = name.as_str(), reason = %error, "seed request failed; retrying");
                    self.sleeper.sleep(Duration::from_secs(2).min(remaining));
                }
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/retry_tests.rs"]
mod tests;
