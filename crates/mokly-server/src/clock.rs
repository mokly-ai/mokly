//! Injectable monotonic time for preview retention.

use std::time::Instant;

/// Process-relative monotonic milliseconds.
#[cfg_attr(test, unimock::unimock(api = ClockMock))]
pub trait Clock: Send + Sync {
    /// Read elapsed process time.
    fn milliseconds(&self) -> u64;
}

/// Production monotonic clock.
pub struct MonotonicClock {
    start: Instant,
}

impl Default for MonotonicClock {
    fn default() -> Self {
        Self {
            start: Instant::now(),
        }
    }
}
impl Clock for MonotonicClock {
    fn milliseconds(&self) -> u64 {
        u64::try_from(self.start.elapsed().as_millis()).unwrap_or(u64::MAX)
    }
}
