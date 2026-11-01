//! Unix ownership of a process tree, including descendants in new sessions.

use std::io;
use std::process::Child;
use std::sync::{Arc, Mutex};

use crate::error::{Error, InternalError, IoResult, Result};
use crate::processes::ProcessGroup;
use crate::unix_process_table::{ProcessIdentity, ProcessTable, SystemTable};

use super::walk;

/// Group-level signal boundary kept separate from process-table inspection.
#[cfg_attr(test, unimock::unimock(api = GroupSignalMock))]
pub(crate) trait GroupSignal: Send + Sync {
    /// Send one signal to the owned process group. The result is true when the
    /// group is already gone and false when the signal reached a live group.
    fn signal(&self, pid: i32, signal: i32) -> io::Result<bool>;
}

/// Unix process-tree ownership guard.
pub(super) struct UnixGroup {
    root: ProcessIdentity,
    retained: Mutex<Vec<ProcessIdentity>>,
    table: Arc<dyn ProcessTable>,
    group: Arc<dyn GroupSignal>,
}

impl UnixGroup {
    /// Create an ownership guard from the process and group boundaries.
    pub(super) fn new(
        root: ProcessIdentity,
        table: Arc<dyn ProcessTable>,
        group: Arc<dyn GroupSignal>,
    ) -> Self {
        Self {
            root,
            retained: Mutex::new(Vec::new()),
            table,
            group,
        }
    }

    fn signal(&self, requested: i32) -> Result<()> {
        let mut retained = match self.retained.lock() {
            Ok(retained) => retained,
            Err(_) => return Err(mutex_error()),
        };
        let mut first_error = None;
        let gone = match self.signal_group(libc::SIGSTOP) {
            Ok(gone) => gone,
            Err(source) => {
                remember(&mut first_error, source);
                false
            }
        };
        let walk = if gone && retained.is_empty() {
            walk::WalkResult {
                found: Vec::new(),
                error: None,
            }
        } else {
            walk::descendants(self.table.as_ref(), self.root, &retained)
        };
        if let Some(error) = walk.error {
            remember(&mut first_error, error);
        }
        *retained = walk.found;
        remember_result(&mut first_error, self.signal_group(requested).map(|_| ()));
        for identity in retained.iter() {
            remember_result(
                &mut first_error,
                signal_process(self.table.as_ref(), *identity, requested),
            );
        }
        if requested == libc::SIGTERM {
            remember_result(
                &mut first_error,
                self.signal_group(libc::SIGCONT).map(|_| ()),
            );
            for identity in retained.iter() {
                remember_result(
                    &mut first_error,
                    signal_process(self.table.as_ref(), *identity, libc::SIGCONT),
                );
            }
        }
        first_error.map_or(Ok(()), |source| {
            Err(Error::Internal(InternalError::Io { source }))
        })
    }

    /// A dead leader's group can still contain owned children. The OS reserves
    /// its group ID until the last member exits. A reused leader PID, however,
    /// belongs to a different process and must never receive a group signal.
    /// Return true when the root cannot anchor a walk or the group is gone.
    fn signal_group(&self, signal: i32) -> io::Result<bool> {
        match self.table.identity(self.root.pid) {
            Ok(Some(current)) if current != self.root => Ok(true),
            Ok(current) => self
                .group
                .signal(self.root.pid, signal)
                .map(|gone| gone || current.is_none()),
            Err(source) => {
                let _ = self.group.signal(self.root.pid, signal);
                Err(source)
            }
        }
    }
}

/// A descendant that vanished between enumeration and signaling is stopped.
fn signal_process(
    table: &dyn ProcessTable,
    identity: ProcessIdentity,
    signal: i32,
) -> io::Result<()> {
    match table.signal(identity, signal) {
        Ok(()) => Ok(()),
        Err(source) if source.raw_os_error() == Some(libc::ESRCH) => Ok(()),
        Err(source) => Err(source),
    }
}

fn remember_result(slot: &mut Option<io::Error>, result: io::Result<()>) {
    if let Err(source) = result {
        remember(slot, source);
    }
}

fn remember(slot: &mut Option<io::Error>, source: io::Error) {
    if slot.is_none() {
        *slot = Some(source);
    }
}

fn mutex_error() -> Error {
    Error::Internal(InternalError::Io {
        source: io::Error::other("Unix process-tree state was poisoned"),
    })
}

impl ProcessGroup for UnixGroup {
    fn terminate(&self) -> Result<()> {
        self.signal(libc::SIGTERM)
    }

    fn kill(&self) -> Result<()> {
        self.signal(libc::SIGKILL)
    }
}

/// Attach a Unix process-tree guard to a live child.
pub(crate) fn attach(child: &Child, group: Arc<dyn GroupSignal>) -> Result<Box<dyn ProcessGroup>> {
    let pid = match i32::try_from(child.id()) {
        Ok(pid) => pid,
        Err(_) => {
            return Err(Error::Internal(InternalError::Io {
                source: io::Error::other("process id exceeds pid_t"),
            }));
        }
    };
    let table: Arc<dyn ProcessTable> = Arc::new(SystemTable);
    let root = table.identity(pid).platform()?.ok_or_else(|| {
        Error::Internal(InternalError::Io {
            source: io::Error::new(io::ErrorKind::NotFound, "child exited before attachment"),
        })
    })?;
    Ok(Box::new(UnixGroup::new(root, table, group)))
}

#[cfg(test)]
#[path = "_tests_/group_tests.rs"]
mod group_tests;
