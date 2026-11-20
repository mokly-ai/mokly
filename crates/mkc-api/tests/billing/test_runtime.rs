//! Mutable integration clock with real UUID generation and deterministic secrets.

use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::{Runtime, SystemRuntime};
use mkc_store_interface::error::Result;
use uuid::Uuid;

pub(super) struct TestRuntime {
    now: Mutex<DateTime<Utc>>,
    sequence: AtomicU64,
}

impl TestRuntime {
    pub(super) fn new(now: DateTime<Utc>) -> Self {
        Self {
            now: Mutex::new(now),
            sequence: AtomicU64::new(1),
        }
    }

    pub(super) fn advance(&self, seconds: i64) {
        let mut now = self.now.lock().unwrap();
        *now += Duration::seconds(seconds);
    }
}

impl Runtime for TestRuntime {
    fn now(&self) -> DateTime<Utc> {
        *self.now.lock().unwrap()
    }

    fn monotonic(&self) -> time::Duration {
        SystemRuntime.monotonic()
    }

    fn id(&self) -> Uuid {
        Uuid::now_v7()
    }

    fn secret(&self) -> Result<String> {
        Ok(format!(
            "{:064x}",
            self.sequence.fetch_add(1, Ordering::SeqCst)
        ))
    }
}
