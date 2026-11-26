//! A child process whose tree guard owns the reap of the root.

use std::io;
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
use std::process::{Child, ExitStatus};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;

use crate::error::{Error, Result};
use crate::processes::{ProcessGroup, ProcessGroups};
#[cfg(unix)]
use crate::unix;
#[cfg(windows)]
use crate::windows;

/// A child process and the guard of its tree.
///
/// The root stays unreaped while this value lives. Its process ID and the
/// number of its process group therefore stay reserved, and no new process
/// or group can take them while the guard can still signal. Drop reaps the
/// root only after the guard is gone.
pub struct ProcessTree {
    // Fields drop in declaration order: the guard first, then the root.
    group: Box<dyn ProcessGroup>,
    root: Root,
}

/// The unreaped root process. Its drop reaps it.
struct Root {
    child: Mutex<Option<Child>>,
    pid: u32,
}

impl ProcessTree {
    /// Join an unreaped child and the guard of its tree. Implementations of
    /// `ProcessGroups::attach` build their tree here. Only they can create a
    /// host guard, and they take the child before they return it.
    pub fn new(child: Child, group: Box<dyn ProcessGroup>) -> Self {
        Self {
            group,
            root: Root {
                pid: child.id(),
                child: Mutex::new(Some(child)),
            },
        }
    }

    /// The process ID of the root. It stays reserved while the tree lives.
    pub fn id(&self) -> u32 {
        self.root.pid
    }

    /// Give back the child and its guard, so that a test double can wrap the
    /// guard or a guard test can control the child. The caller then owns the
    /// rule that the reap follows the last signal.
    #[cfg(any(test, feature = "mock"))]
    pub fn into_parts(self) -> (Child, Box<dyn ProcessGroup>) {
        let Self { group, root } = self;
        let child = root.lock().take();
        match child {
            Some(child) => (child, group),
            // `new` stores the child, and only the drop of the root takes it.
            None => unreachable!("a live process tree holds its root"),
        }
    }

    /// Block until the root exits, and return its status. The root stays
    /// unreaped, so later signals of the guard cannot reach a new process.
    pub fn wait(&self) -> io::Result<ExitStatus> {
        #[cfg(unix)]
        return unix::wait_exit(self.root.pid);
        #[cfg(windows)]
        {
            let handle = {
                let child = self.root.lock();
                present(&child)?.as_raw_handle()
            };
            windows::wait_exit(handle)?;
            let mut child = self.root.lock();
            let child = match child.as_mut() {
                Some(child) => child,
                None => return Err(reaped()),
            };
            child
                .try_wait()?
                .ok_or_else(|| io::Error::other("process did not exit"))
        }
    }

    /// Kill the root process directly, without the guard. A root that has
    /// already exited is stopped, also where the host answers that it is gone.
    pub fn kill_root(&self) -> io::Result<()> {
        let mut child = self.root.lock();
        let Some(child) = child.as_mut() else {
            return Err(reaped());
        };
        match child.kill() {
            #[cfg(unix)]
            Err(source) if source.raw_os_error() == Some(libc::ESRCH) => Ok(()),
            result => result,
        }
    }

    /// Stop the tree as `ProcessGroups::kill_unattached` does, anchored on
    /// the unreaped root. Use it when the guard's own kill fails.
    pub fn kill_unattached(&self, groups: &dyn ProcessGroups) -> Result<()> {
        let child = self.root.lock();
        match present(&child) {
            Ok(child) => groups.kill_unattached(child),
            Err(source) => Err(Error::io(source)),
        }
    }
}

impl ProcessGroup for ProcessTree {
    fn terminate(&self) -> Result<()> {
        self.group.terminate()
    }

    fn kill(&self) -> Result<()> {
        self.group.kill()
    }
}

impl Root {
    fn lock(&self) -> MutexGuard<'_, Option<Child>> {
        self.child.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// The guard has already dropped, so no signal can follow this reap. A root
/// that still runs is reaped on its own thread when it exits.
impl Drop for Root {
    fn drop(&mut self) {
        let child = self.child.get_mut().unwrap_or_else(PoisonError::into_inner);
        let Some(mut child) = child.take() else {
            return;
        };
        match child.try_wait() {
            Ok(Some(_)) => {}
            Ok(None) => {
                let reaper = thread::Builder::new()
                    .name("mokly-process-reaper".into())
                    .spawn(move || {
                        let _ = child.wait();
                    });
                if let Err(error) = reaper {
                    tracing::warn!(%error, "could not start the reaper of a process tree root");
                }
            }
            Err(error) => tracing::warn!(%error, "could not reap a process tree root"),
        }
    }
}

fn present<'a>(child: &'a MutexGuard<'_, Option<Child>>) -> io::Result<&'a Child> {
    match child.as_ref() {
        Some(child) => Ok(child),
        None => Err(reaped()),
    }
}

fn reaped() -> io::Error {
    io::Error::other("process tree root was already reaped")
}
