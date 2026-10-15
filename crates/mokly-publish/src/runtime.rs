//! Injectable clocks, randomness, cancellation, and progress.

use std::fmt;
use std::time::Duration;

use chrono::Utc;
use futures_util::future::BoxFuture;
use rand::RngExt;
use tokio_util::sync::CancellationToken;

use crate::accounting::Progress;

/// Timer purpose recorded by the retry policy for deterministic tests.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Timer {
    /// A retry wait.
    Backoff,
}

/// Time and jitter boundary used by the exchange state machine.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClockMock))]
pub trait Clock: Send + Sync {
    /// Current UTC epoch milliseconds.
    fn now(&self) -> i64;
    /// Uniform jitter in the inclusive zero-to-maximum millisecond range.
    fn jitter(&self, maximum: u64) -> u64;
    /// Wait until this duration ends; dropping the future cancels the wait.
    fn sleep(&self, timer: Timer, duration: Duration) -> BoxFuture<'_, ()>;
}

/// Host clock and random source, constructed only by the composition root.
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> i64 {
        Utc::now().timestamp_millis()
    }
    fn jitter(&self, maximum: u64) -> u64 {
        rand::rng().random_range(0..=maximum)
    }
    fn sleep(&self, _: Timer, duration: Duration) -> BoxFuture<'_, ()> {
        Box::pin(tokio::time::sleep(duration))
    }
}

/// Cancellation must be observed by the operation that it actually aborts.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CancellationMock))]
pub trait Cancellation: mokly_git::command::Cancellation {
    /// Remain pending until cancellation; dropping the future stops this observation.
    fn cancelled(&self) -> BoxFuture<'_, ()>;
}

impl Cancellation for CommandCancellation {
    fn cancelled(&self) -> BoxFuture<'_, ()> {
        Box::pin(self.token.cancelled())
    }
}

impl mokly_git::command::Cancellation for CommandCancellation {
    fn is_cancelled(&self) -> bool {
        self.token.is_cancelled()
    }
}

/// Shared cancellation handle for the CLI and Git runner.
#[derive(Clone, Default)]
pub struct CommandCancellation {
    /// The composition root cancels this token on SIGINT or SIGTERM.
    pub token: CancellationToken,
}

/// Safe accounting events; credentials and receiver responses never enter it.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ReporterMock))]
pub trait Reporter: Send + Sync {
    /// Reset the visible label before each Plan, including an empty re-plan.
    fn round(&self, _round: usize) {}
    /// Report initial or advanced progress for a round with missing blobs.
    fn progress(&self, progress: &Progress);
}

/// Observer for a caller that needs no progress presentation.
pub struct SilentReporter;

impl Reporter for SilentReporter {
    fn progress(&self, _: &Progress) {}
}

impl fmt::Debug for dyn Cancellation + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Cancellation")
    }
}
