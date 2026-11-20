//! Injectable UTC time for absolute attempt budget accounting.

use chrono::{DateTime, Utc};

/// Clock used before sandbox work and every process.
#[unimock::unimock(api = BuildClockMock)]
pub trait BuildClock: Send + Sync {
    /// Read the current absolute time.
    fn now(&self) -> DateTime<Utc>;
}

/// System UTC clock composed by the caller.
pub struct SystemBuildClock;

impl BuildClock for SystemBuildClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}
