//! Reconnect delays shared by the two relay workers.

use std::time::Duration;

const FIRST_BACKOFF: Duration = Duration::from_millis(500);
const MAX_BACKOFF: Duration = Duration::from_secs(15);

/// The next reconnect delay for one worker.
pub(super) struct Backoff(Duration);

impl Default for Backoff {
    fn default() -> Self {
        Self(FIRST_BACKOFF)
    }
}

impl Backoff {
    /// Take the current delay and double the next one up to the ceiling.
    pub(super) fn next_delay(&mut self) -> Duration {
        let delay = self.0;
        self.0 = (delay * 2).min(MAX_BACKOFF);
        delay
    }
}
