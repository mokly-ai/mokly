//! Shared clock guard for lease ownership checks after database locks.

use std::fmt;

use chrono::{DateTime, Utc};

/// A live clock sampled by ownership queries after their required locks.
/// Pass this guard into each retry; never replace it with a captured time.
/// Claims, renewals and upload-grant consumption use this guard at the query boundary.
/// A candidate scan may use an earlier observation to find work. Ownership checks
/// sample the clock only after every required row lock is held. A claim rechecks
/// eligibility under its organization and build locks. Each transaction retry
/// samples again after it reacquires those locks.
///
/// Callers keep attempt IDs, lease tokens and upload secrets fixed across retries.
/// Attempt start time, lease expiry and deadline come from the fresh reading
/// taken under the claim locks.
#[unimock::unimock(api = BuildClockMock)]
pub trait BuildClock: Send + Sync {
    /// Read the current UTC time at the guarded point in the query.
    fn now(&self) -> DateTime<Utc>;
}

impl fmt::Debug for dyn BuildClock + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("BuildClock")
    }
}

impl<F> BuildClock for F
where
    F: Fn() -> DateTime<Utc> + Send + Sync,
{
    fn now(&self) -> DateTime<Utc> {
        self()
    }
}
