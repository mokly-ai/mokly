//! Graceful Git cancellation with bounded, testable process-tree cleanup.

use std::process::{Child, ExitStatus};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use mokly_platform::processes::ProcessGroup;

use crate::error::{Error, InternalError, IoResult, Result};

#[cfg_attr(test, unimock::unimock(api = ShutdownMock))]
/// Child state and grace-period waits observed by cancellation.
pub(crate) trait Shutdown {
    /// Read exit state and whether both capture workers have finished.
    fn poll(&self) -> Result<(Option<ExitStatus>, bool)>;
    /// Wait for one bounded grace-period tick.
    fn pause(&self);
}

/// Host child process and the capture-worker completion probe.
pub(crate) struct ChildShutdown<'a> {
    /// Child handle shared only while querying its cached exit state.
    pub(crate) child: Mutex<&'a mut Child>,
    /// True after both capture workers have stopped.
    pub(crate) drained: &'a dyn Fn() -> bool,
}

impl Shutdown for ChildShutdown<'_> {
    fn poll(&self) -> Result<(Option<ExitStatus>, bool)> {
        let Ok(mut child) = self.child.lock() else {
            return Err(Error::Internal(InternalError::Worker));
        };
        Ok((child.try_wait().git()?, (self.drained)()))
    }
    fn pause(&self) {
        thread::sleep(Duration::from_millis(10));
    }
}

pub(crate) fn graceful(group: &dyn ProcessGroup, shutdown: &dyn Shutdown) -> Result<bool> {
    if let Err(source) = group.terminate() {
        return Err(Error::Platform { source });
    }
    for _ in 0..100 {
        let (status, drained) = shutdown.poll()?;
        if status.is_some() && drained {
            return Ok(true);
        }
        shutdown.pause();
    }
    let (status, drained) = shutdown.poll()?;
    if (status.is_none() || !drained)
        && let Err(source) = group.kill()
    {
        return Err(Error::Platform { source });
    }
    Ok(status.is_some())
}

#[cfg(test)]
#[path = "_tests_/cancellation_tests.rs"]
mod cancellation_tests;
