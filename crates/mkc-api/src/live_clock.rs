//! Monotonic clock used for socket keepalive and periodic access checks.

use std::future::Future;
use std::pin::Pin;

use tokio::time::{Instant, sleep_until};

/// Timing boundary for a running WebSocket.
pub trait LiveClock: Send + Sync {
    /// The current monotonic instant.
    fn now(&self) -> Instant;

    /// Wait for a deadline. Dropping this wait leaves the clock unchanged.
    fn wait_until(&self, at: Instant) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
}

/// Use the serving Tokio runtime's monotonic clock.
pub struct TokioLiveClock;

impl LiveClock for TokioLiveClock {
    fn now(&self) -> Instant {
        Instant::now()
    }

    fn wait_until(&self, at: Instant) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(sleep_until(at))
    }
}
