//! Real process groups whose guards record, at each signal, whether the root
//! process was already reaped. A test runs a caller with these groups and
//! checks that no tree signal follows the reap of the root.

use std::io;
use std::mem::MaybeUninit;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex, PoisonError};

use mokly_platform::error::Result;
use mokly_platform::processes::{
    AttachFailure, ProcessGroup, ProcessGroups, ProcessTree, SystemProcessGroups,
};

/// The state of the root process when its guard sent one signal.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Root {
    /// The root runs, or it has exited and still holds its process ID.
    Unreaped,
    /// The root is gone from the wait queue, so its ID can pass to a new
    /// process.
    Reaped,
}

/// System process groups that record the root state at each tree signal.
#[derive(Default)]
pub struct Watched {
    states: Arc<Mutex<Vec<Root>>>,
    roots: Mutex<Vec<u32>>,
}

impl Watched {
    /// The process ID of each attached root, in attach order.
    pub fn roots(&self) -> Vec<u32> {
        self.roots
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    /// The root state at each tree signal so far, in order.
    pub fn states(&self) -> Vec<Root> {
        self.states
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }
}

impl ProcessGroups for Watched {
    fn configure(&self, command: &mut Command) -> Result<()> {
        SystemProcessGroups.configure(command)
    }

    fn configure_plain(&self, command: &mut Command) -> Result<()> {
        SystemProcessGroups.configure_plain(command)
    }

    fn attach(&self, child: Child) -> std::result::Result<ProcessTree, AttachFailure> {
        let pid = child.id();
        self.roots
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(pid);
        let (child, inner) = SystemProcessGroups.attach(child)?.into_parts();
        let group = WatchedGroup {
            pid,
            inner,
            states: Arc::clone(&self.states),
        };
        Ok(ProcessTree::new(child, Box::new(group)))
    }

    fn kill_unattached(&self, child: &Child) -> Result<()> {
        SystemProcessGroups.kill_unattached(child)
    }
}

struct WatchedGroup {
    pid: u32,
    inner: Box<dyn ProcessGroup>,
    states: Arc<Mutex<Vec<Root>>>,
}

impl WatchedGroup {
    fn record(&self) {
        let root = root(self.pid);
        self.states
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(root);
    }
}

impl ProcessGroup for WatchedGroup {
    fn terminate(&self) -> Result<()> {
        self.record();
        self.inner.terminate()
    }

    fn kill(&self) -> Result<()> {
        self.record();
        self.inner.kill()
    }
}

/// Read the state of a child of this process. WNOHANG and WNOWAIT neither
/// block nor reap, so the check leaves an unreaped child as it is.
pub fn root(pid: u32) -> Root {
    let mut info = MaybeUninit::<libc::siginfo_t>::zeroed();
    // SAFETY: The buffer has the exact siginfo_t size and stays alive for the
    // call. WNOHANG and WNOWAIT neither block nor reap.
    let result = unsafe {
        libc::waitid(
            libc::P_PID,
            pid,
            info.as_mut_ptr(),
            libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
        )
    };
    let error = io::Error::last_os_error();
    if result == -1 && error.raw_os_error() == Some(libc::ECHILD) {
        return Root::Reaped;
    }
    assert_eq!(result, 0, "waitid failed: {error}");
    Root::Unreaped
}
