//! Process-group setup and whole-tree cancellation boundaries.

use std::process::{Child, Command};

use crate::error::{Error, Result};
#[cfg(unix)]
use crate::unix;
#[cfg(windows)]
use crate::windows;

mod tree;
pub use tree::ProcessTree;

/// A child tree owned by one command; keep this guard until pipes close.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ProcessGroupMock))]
pub trait ProcessGroup: Send + Sync {
    /// Request graceful termination of the process tree.
    fn terminate(&self) -> Result<()>;
    /// Force termination of the process tree.
    fn kill(&self) -> Result<()>;
}

/// Host process-tree ownership boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ProcessGroupsMock))]
pub trait ProcessGroups: Send + Sync {
    /// Configure a new process tree before starting the command.
    fn configure(&self, command: &mut Command) -> Result<()>;
    /// Configure a helper-free child in its own group without a Unix exec hook.
    fn configure_plain(&self, command: &mut Command) -> Result<()>;
    /// Take the child immediately after spawn and acquire its tree guard. The
    /// returned [`ProcessTree`] owns the child and reaps it only after the
    /// guard's last signal, so no caller can reap the root early.
    fn attach(&self, child: Child) -> std::result::Result<ProcessTree, AttachFailure>;
    /// Stop a configured child's tree before its first reap when attachment fails.
    fn kill_unattached(&self, child: &Child) -> Result<()>;
}

/// A failed attachment, with the child that it gives back. No guard exists, so
/// the caller stops the tree with [`ProcessGroups::kill_unattached`] and then
/// reaps the child itself.
#[derive(Debug, thiserror::Error)]
#[error("[platform] could not attach the process tree")]
pub struct AttachFailure {
    /// The unreaped child of the failed attachment.
    pub child: Child,
    /// The cause of the failure.
    #[source]
    pub source: Error,
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

    fn configure_plain(&self, command: &mut Command) -> Result<()> {
        #[cfg(unix)]
        unix::configure_plain(command);
        #[cfg(windows)]
        windows::configure(command);
        Ok(())
    }

    fn attach(&self, child: Child) -> std::result::Result<ProcessTree, AttachFailure> {
        #[cfg(unix)]
        let group = unix::attach(&child);
        #[cfg(windows)]
        let group = windows::attach(&child);
        match group {
            Ok(group) => Ok(ProcessTree::new(child, group)),
            Err(source) => Err(AttachFailure { child, source }),
        }
    }

    fn kill_unattached(&self, child: &Child) -> Result<()> {
        #[cfg(unix)]
        return unix::kill_unattached(child);
        #[cfg(windows)]
        return windows::kill_unattached(child);
    }
}
