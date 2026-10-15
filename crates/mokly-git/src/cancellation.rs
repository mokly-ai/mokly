//! Route generation and command cancellation through one timed signal state.

use std::time::Duration;

use mokly_platform::processes::ProcessGroup;

use crate::control::{Shutdown, Signal};
use crate::error::{Error, Result};

pub(crate) fn signal(
    shutdown: &mut Shutdown,
    group: &dyn ProcessGroup,
    now: Duration,
    cancelled: bool,
) -> Result<()> {
    let result = match shutdown.step(now, cancelled) {
        Some(Signal::Terminate) => group.terminate(),
        Some(Signal::Kill) => group.kill(),
        None => return Ok(()),
    };
    match result {
        Ok(()) => Ok(()),
        Err(source) => Err(Error::Platform { source }),
    }
}

#[cfg(test)]
#[path = "_tests_/cancellation_tests.rs"]
mod cancellation_tests;
