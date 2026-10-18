//! System deadlines and injectable bounded waits for pipe and exit messages.

use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

use crate::error::{Error, Result};
use crate::wire::Frame;
use crate::workers::Clock;

/// Deadline waits used by the concrete process transport.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = WaitMock))]
pub trait Wait: Clock {
    /// Wait for a pipe frame until an absolute monotonic deadline.
    fn frame(
        &self,
        receiver: &Receiver<Result<Frame>>,
        deadline: u64,
        timeout_ms: u64,
    ) -> Result<Frame>;
    /// Wait for child exit until a shared absolute shutdown deadline.
    fn exited(&self, receiver: &Receiver<()>, deadline: u64) -> bool;
    /// Wait for stderr EOF until the same shared shutdown deadline.
    fn drained(&self, receiver: &Receiver<()>, deadline: u64) -> bool;
    /// Wait for the reaper after forced termination, without another graceful period.
    fn reaped(&self, receiver: &Receiver<()>);
}

/// System monotonic clock; construct one shared instance at the composition root.
pub struct SystemClock {
    epoch: Instant,
}

impl SystemClock {
    /// Start the monotonic epoch without reading wall-clock time.
    pub fn new() -> Self {
        Self {
            epoch: Instant::now(),
        }
    }
}

impl Default for SystemClock {
    fn default() -> Self {
        Self::new()
    }
}

impl Clock for SystemClock {
    fn now_ms(&self) -> u64 {
        self.epoch
            .elapsed()
            .as_millis()
            .try_into()
            .unwrap_or(u64::MAX)
    }
}

impl Wait for SystemClock {
    fn drained(&self, receiver: &Receiver<()>, deadline: u64) -> bool {
        self.exited(receiver, deadline)
    }

    fn reaped(&self, receiver: &Receiver<()>) {
        let _ = receiver.recv();
    }

    fn frame(
        &self,
        receiver: &Receiver<Result<Frame>>,
        deadline: u64,
        timeout_ms: u64,
    ) -> Result<Frame> {
        match receiver.recv_timeout(Duration::from_millis(
            deadline.saturating_sub(self.now_ms()),
        )) {
            Ok(result) => result,
            Err(RecvTimeoutError::Timeout) => Err(Error::Timeout {
                deadline_ms: timeout_ms,
            }),
            Err(RecvTimeoutError::Disconnected) => Err(Error::Crashed),
        }
    }

    fn exited(&self, receiver: &Receiver<()>, deadline: u64) -> bool {
        !matches!(
            receiver.recv_timeout(Duration::from_millis(
                deadline.saturating_sub(self.now_ms())
            )),
            Err(RecvTimeoutError::Timeout)
        )
    }
}
