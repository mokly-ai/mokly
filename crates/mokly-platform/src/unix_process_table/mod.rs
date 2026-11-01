//! Unix process identity, parent enumeration, and PID-safe signal boundaries.

use std::io;

/// Identity that remains stable while a PID names one process instance.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub(super) struct ProcessIdentity {
    /// Process ID used by parent links and signals.
    pub(super) pid: i32,
    /// Platform process start time.
    pub(super) start: u128,
}

/// Impure process-table boundary used by the descendant walk.
#[cfg_attr(test, unimock::unimock(api = [IdentityMock, ChildrenMock, SignalMock]))]
pub(super) trait ProcessTable: Send + Sync {
    /// Read the current identity, including an exited process until it is reaped.
    /// Return `None` when the PID no longer identifies a process.
    fn identity(&self, pid: i32) -> io::Result<Option<ProcessIdentity>>;
    /// Return direct children with identities read from the same table.
    fn children(&self, pid: i32) -> io::Result<Vec<ProcessIdentity>>;
    /// Confirm the identity and send one signal to the process.
    fn signal(&self, identity: ProcessIdentity, signal: i32) -> io::Result<()>;
}

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub(crate) use linux::SystemTable;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub(crate) use macos::SystemTable;
