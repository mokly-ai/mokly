//! Process-group setup and whole-tree cancellation boundaries.

use std::process::{Child, Command};

use crate::error::Result;
#[cfg(unix)]
use crate::unix;
#[cfg(windows)]
use crate::windows;

/// A child tree owned by one command; keep this guard until pipes close.
pub trait ProcessGroup: Send + Sync {
    /// Request graceful termination of the process tree.
    fn terminate(&self) -> Result<()>;
    /// Force termination of the process tree.
    fn kill(&self) -> Result<()>;
}

/// Host process-tree ownership boundary.
pub trait ProcessGroups: Send + Sync {
    /// Configure a new process tree before starting the command.
    fn configure(&self, command: &mut Command) -> Result<()>;
    /// Acquire the process-tree guard immediately after spawn.
    fn attach(&self, child: &Child) -> Result<Box<dyn ProcessGroup>>;
}

/// Host implementation: Unix process groups or Windows kill-on-close jobs.
pub struct SystemProcessGroups;

impl ProcessGroups for SystemProcessGroups {
    fn configure(&self, command: &mut Command) -> Result<()> {
        #[cfg(unix)]
        unix::configure(command);
        #[cfg(windows)]
        windows::configure(command);
        Ok(())
    }

    fn attach(&self, child: &Child) -> Result<Box<dyn ProcessGroup>> {
        #[cfg(unix)]
        return unix::attach(child);
        #[cfg(windows)]
        return windows::attach(child);
    }
}
