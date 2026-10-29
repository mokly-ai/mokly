//! Unix ownership of a process tree, including descendants in new sessions.

use std::io;
use std::process::Child;
use std::sync::{Arc, Mutex};

use crate::error::{Error, InternalError, IoResult, Result};
use crate::processes::ProcessGroup;

use super::unix_process_table::{ProcessIdentity, ProcessTable, SystemTable};

pub(crate) mod walk;

/// Group-level signal boundary kept separate from process-table inspection.
#[cfg_attr(test, unimock::unimock(api = GroupSignalMock))]
pub(super) trait GroupSignal: Send + Sync {
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
        let mut retained = self.retained.lock().map_err(|_| mutex_error())?;
        let previous = retained.clone();
        let stopped = self.group.signal(self.root.pid, libc::SIGSTOP);
        let mut first_error = stopped.as_ref().err().map(clone_io_error);
        let walk = if matches!(stopped, Ok(true)) && previous.is_empty() {
            walk::WalkResult {
                found: previous,
                error: None,
            }
        } else {
            walk::descendants(self.table.as_ref(), self.root, &previous)
        };
        if let Some(error) = walk.error {
            remember(&mut first_error, error);
        }
        for identity in walk.found {
            if !retained.contains(&identity) {
                retained.push(identity);
            }
        }
        let identities = retained.clone();
        remember_result(
            &mut first_error,
            self.group.signal(self.root.pid, requested).map(|_| ()),
        );
        for identity in &identities {
            remember_result(
                &mut first_error,
                signal_process(self.table.as_ref(), *identity, requested),
            );
        }
        if requested == libc::SIGTERM {
            remember_result(
                &mut first_error,
                self.group.signal(self.root.pid, libc::SIGCONT).map(|_| ()),
            );
            for identity in &identities {
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
}

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

fn clone_io_error(source: &io::Error) -> io::Error {
    io::Error::new(source.kind(), source.to_string())
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
pub(super) fn attach(child: &Child, group: Arc<dyn GroupSignal>) -> Result<Box<dyn ProcessGroup>> {
    let pid = i32::try_from(child.id()).map_err(|_| {
        Error::Internal(InternalError::Io {
            source: io::Error::other("process id exceeds pid_t"),
        })
    })?;
    let table: Arc<dyn ProcessTable> = Arc::new(SystemTable);
    let root = table.identity(pid).platform()?.ok_or_else(|| {
        Error::Internal(InternalError::Io {
            source: io::Error::new(io::ErrorKind::NotFound, "child exited before attachment"),
        })
    })?;
    Ok(Box::new(UnixGroup::new(root, table, group)))
}

/// Build a production Unix group guard with the system process-table adapter.
pub(super) fn attach_system(
    child: &Child,
    group: Arc<dyn GroupSignal>,
) -> Result<Box<dyn ProcessGroup>> {
    attach(child, group)
}

#[cfg(test)]
#[path = "_tests_/unix_process_tree_tests.rs"]
mod unix_process_tree_tests;
