//! Injected monotonic retry budget and blocking sleep at the command boundary.

use std::thread;
use std::time::{Duration, Instant};

#[cfg_attr(test, unimock::unimock(api = ClockMock))]
pub(super) trait Clock: Send + Sync {
    fn now(&self) -> Duration;
}

#[cfg_attr(test, unimock::unimock(api = SleeperMock))]
pub(super) trait Sleeper: Send + Sync {
    fn sleep(&self, duration: Duration);
}

pub(super) struct SystemClock {
    pub(super) started: Instant,
}

pub(super) struct SystemSleeper;

impl Clock for SystemClock {
    fn now(&self) -> Duration {
        self.started.elapsed()
    }
}

impl Sleeper for SystemSleeper {
    fn sleep(&self, duration: Duration) {
        thread::sleep(duration);
    }
}
