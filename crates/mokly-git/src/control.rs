//! Injectable cancellation and monotonic time for owned commands.

use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

/// Cancellation boundary shared by one command generation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CancellationMock))]
pub trait Cancellation: Send + Sync {
    /// Whether the owner requested cancellation.
    fn cancelled(&self) -> bool;
}

/// Thread-safe cancellation source.
#[derive(Default)]
pub struct Token(AtomicBool);

impl Token {
    /// Request cancellation. Every observer sees the request.
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Release);
    }
}

impl Cancellation for Token {
    fn cancelled(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

/// Monotonic clock and polling boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClockMock))]
pub trait Clock: Send + Sync {
    /// Time since an arbitrary fixed epoch.
    fn now(&self) -> Duration;
    /// Yield until the next supervision poll.
    fn pause(&self, duration: Duration);
}

/// Host monotonic clock.
pub struct SystemClock(Instant);

impl Default for SystemClock {
    fn default() -> Self {
        Self(Instant::now())
    }
}

impl Clock for SystemClock {
    fn now(&self) -> Duration {
        self.0.elapsed()
    }

    fn pause(&self, duration: Duration) {
        thread::sleep(duration);
    }
}

/// Signal selected by the pure shutdown state machine.
#[derive(Debug, Eq, PartialEq)]
pub enum Signal {
    /// Send graceful termination once.
    Terminate,
    /// Send forceful termination once after the grace period.
    Kill,
}

/// Shutdown state, independent of the process and clock implementations.
#[derive(Default)]
pub struct Shutdown {
    requested: Option<Duration>,
    killed: bool,
}

impl Shutdown {
    /// Request SIGTERM immediately and SIGKILL at the one-second boundary.
    pub fn step(&mut self, now: Duration, cancelled: bool) -> Option<Signal> {
        match self.requested {
            None if cancelled => {
                self.requested = Some(now);
                Some(Signal::Terminate)
            }
            Some(start) if !self.killed && now.saturating_sub(start) >= Duration::from_secs(1) => {
                self.killed = true;
                Some(Signal::Kill)
            }
            _ => None,
        }
    }
}

#[cfg(test)]
#[path = "_tests_/control_tests.rs"]
mod control_tests;
