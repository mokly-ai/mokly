//! Pauses of the polling worker loops after a pass that finds no work.

use std::time::Duration;

/// How long each polling worker loop waits after a pass.
///
/// Production uses [`WorkerIntervals::default`]: a one-second pause for each
/// webhook delivery loop, five seconds between check delivery passes, and two
/// seconds after a build claim that finds no build. An embedded composition,
/// such as an integration test, may set a shorter pause, so it does not wait
/// for work that the loop would start at once.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WorkerIntervals {
    /// The GitHub webhook delivery loop.
    pub github_delivery: Duration,
    /// The billing webhook delivery loop.
    pub billing_delivery: Duration,
    /// The publication and build check delivery loop, after each pass.
    pub check_delivery: Duration,
    /// The build claim loop, after a claim that finds no build.
    pub build_claim: Duration,
}

impl Default for WorkerIntervals {
    fn default() -> Self {
        Self {
            github_delivery: Duration::from_secs(1),
            billing_delivery: Duration::from_secs(1),
            check_delivery: Duration::from_secs(5),
            build_claim: Duration::from_secs(2),
        }
    }
}
