//! Production adapters for time and retry waiting.

use std::thread;
use std::time::Duration;

use chrono::{DateTime, Utc};
use mkc_github_interface::credentials::{Clock, Sleeper};

/// System UTC clock used at the composition root.
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

/// Blocking sleeper; provider calls already execute off the async reactor.
pub struct ThreadSleeper;

impl Sleeper for ThreadSleeper {
    fn sleep(&self, duration: Duration) {
        thread::sleep(duration);
    }
}
