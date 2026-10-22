//! Package-manager supervision with fakeable process and clock boundaries.

use std::ffi::OsString;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::{Cancellation, Clock, Shutdown, Signal};

use crate::cache_types::Storage;
use crate::error::{Error, InternalError, Result};
use crate::storage_tree::vanished;

/// A shell-free package-manager invocation.
#[derive(Clone, Debug)]
pub struct Command {
    /// Package manager or Node executable.
    pub program: OsString,
    /// Exact arguments.
    pub args: Vec<OsString>,
    /// Private installation directory.
    pub directory: PathBuf,
    /// Monotonic deadline allowance.
    pub timeout: Duration,
    /// Optional bound of the installation tree, checked during execution.
    pub byte_limit: Option<u64>,
    /// Whole private install root when the command runs in a configured package.
    pub size_root: Option<PathBuf>,
    /// Private cache or mirror path for the manager: the confined Yarn Berry
    /// cache folder, or the Yarn Classic offline mirror.
    pub cache: Option<PathBuf>,
    /// Probed Node for scripts-on installs; its folder leads the child PATH.
    pub node: Option<PathBuf>,
}

/// Reaped process result after pipe workers close.
#[derive(Debug)]
pub struct Output {
    /// Whether the process exited successfully.
    pub success: bool,
    /// Process exit code, absent after termination.
    pub status: Option<i32>,
    /// Bounded binary standard output.
    pub stdout: Vec<u8>,
}

/// One owned child tree, including its output pipes.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChildMock))]
pub trait Child: Send + Sync {
    /// Whether the process has exited and every pipe has closed.
    fn poll(&mut self) -> Result<bool>;
    /// Request graceful whole-tree termination.
    fn terminate(&mut self) -> Result<()>;
    /// Force whole-tree termination.
    fn kill(&mut self) -> Result<()>;
    /// Reap the process and drain its pipes.
    fn finish(&mut self) -> Result<Output>;
}

/// Process creation boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SpawnerMock))]
pub trait Spawner: Send + Sync {
    /// Start one owned package-manager command without a shell.
    fn spawn(&self, command: &Command) -> Result<Box<dyn Child>>;
}

/// Bounded package-manager command boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CommandsMock))]
pub trait Commands: Send + Sync {
    /// Execute one command, respecting cancellation, deadline and size.
    fn run(&self, command: &Command) -> Result<Vec<u8>>;
}

/// Deterministic supervisor composed with process, clock and storage traits.
pub struct TimedCommands {
    /// Process adapter.
    pub spawner: Arc<dyn Spawner>,
    /// Monotonic time and polling.
    pub clock: Arc<dyn Clock>,
    /// Command cancellation.
    pub cancellation: Arc<dyn Cancellation>,
    /// Installation-size boundary.
    pub storage: Arc<dyn Storage>,
}

impl Commands for TimedCommands {
    fn run(&self, command: &Command) -> Result<Vec<u8>> {
        if self.cancellation.cancelled() {
            return Err(Error::Cancelled);
        }
        let start = self.clock.now();
        let mut child = self.spawner.spawn(command)?;
        let mut shutdown = Shutdown::default();
        let mut cancelled = false;
        let mut settled = false;
        let mut size_check = start;
        let result = loop {
            let now = self.clock.now();
            cancelled |= self.cancellation.cancelled();
            match shutdown.step(now, cancelled) {
                Some(Signal::Terminate) => {
                    let _ = child.terminate();
                }
                Some(Signal::Kill) => {
                    let _ = child.kill();
                }
                None => {}
            }
            if !cancelled && now.saturating_sub(start) >= command.timeout {
                break Err(Error::InstallTimeout);
            }
            if !cancelled
                && now >= size_check
                && let Some(limit) = command.byte_limit
            {
                match self.storage.size(
                    command.size_root.as_deref().unwrap_or(&command.directory),
                    limit,
                ) {
                    Ok(_) => {}
                    Err(Error::Internal(InternalError::Io { source })) if vanished(&source) => {}
                    Err(error) => break Err(error),
                }
                size_check = now.saturating_add(Duration::from_secs(1));
            }
            match child.poll() {
                Ok(true) => {
                    settled = true;
                    break if cancelled {
                        Err(Error::Cancelled)
                    } else {
                        Ok(())
                    };
                }
                Ok(false) => self.clock.pause(Duration::from_millis(5)),
                Err(error) => break Err(error),
            }
        };
        if result.is_err() && !settled {
            let _ = child.kill();
        }
        let output = child.finish();
        if cancelled {
            return Err(Error::Cancelled);
        }
        result?;
        let output = output?;
        if !output.success {
            return Err(Error::InstallFailed {
                status: output.status,
            });
        }
        Ok(output.stdout)
    }
}

#[cfg(test)]
#[path = "_tests_/commands_tests.rs"]
mod commands_tests;

#[cfg(test)]
#[path = "_tests_/commands_size_tests.rs"]
mod commands_size_tests;
