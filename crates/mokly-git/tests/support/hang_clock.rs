//! A supervision clock that reaches a conversion deadline only after a
//! hanging filter has started.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use mokly_git::control::{Clock, SystemClock};

/// Follows the system clock and jumps past the conversion deadline once for
/// each line that the hanging filter writes to its log, so a hang ends at
/// once while a fast conversion never reaches its deadline.
///
/// The jump happens in `pause`, which the runner calls only after it reads
/// the start time of a command. A line that the filter writes before that
/// read therefore still moves the clock past the deadline of the command.
/// The time and the wait come from `SystemClock`, so Git completion still
/// wakes the runner during a pause.
pub struct HangClock {
    system: SystemClock,
    log: PathBuf,
    jumps: Mutex<u32>,
}

impl HangClock {
    /// A clock that starts now and watches the filter log at `log`.
    pub fn new(log: PathBuf) -> Self {
        Self {
            system: SystemClock::default(),
            log,
            jumps: Mutex::new(0),
        }
    }
}

impl Clock for HangClock {
    fn now(&self) -> Duration {
        self.system.now() + Duration::from_secs(121) * *self.jumps.lock().unwrap()
    }

    fn pause(&self, duration: Duration) {
        let hangs =
            fs::read(&self.log).map_or(0, |log| log.iter().filter(|byte| **byte == b'\n').count());
        {
            let mut jumps = self.jumps.lock().unwrap();
            *jumps = (*jumps).max(hangs as u32);
        }
        self.system.pause(duration);
    }
}
