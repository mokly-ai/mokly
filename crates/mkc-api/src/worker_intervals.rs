//! Pauses of the webhook delivery loops after a poll that finds no delivery.

use std::time::Duration;

/// How long each webhook delivery loop waits after a poll that finds no work.
///
/// Production uses [`WorkerIntervals::default`], a one-second pause for each
/// loop. An embedded composition, such as an integration test, may set a
/// shorter pause, so it does not wait a second for a delivery that the loop
/// would start at once.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WorkerIntervals {
    /// The GitHub webhook delivery loop.
    pub github_delivery: Duration,
    /// The billing webhook delivery loop.
    pub billing_delivery: Duration,
}

impl Default for WorkerIntervals {
    fn default() -> Self {
        Self {
            github_delivery: Duration::from_secs(1),
            billing_delivery: Duration::from_secs(1),
        }
    }
}
