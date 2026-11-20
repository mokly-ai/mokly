//! Production adapters for time and retry waiting.

use std::thread;
use std::time::Duration;

use chrono::{DateTime, Utc};
use mkc_billing_interface::credentials::{Clock, Sleeper};

/// System UTC clock used at the composition root.
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

/// Blocking sleeper for provider calls running off the async reactor.
pub struct ThreadSleeper;

impl Sleeper for ThreadSleeper {
    fn sleep(&self, duration: Duration) {
        thread::sleep(duration);
    }
}
