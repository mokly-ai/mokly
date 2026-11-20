//! Failed attachment keeps an unreaped child as the PID-safe descendant anchor.

use std::io;
use std::process::Child;

use crate::error::{Error, Result};
use crate::unix_process_table::{ProcessTable, SystemTable};

use super::group::{GroupSignal, remember, remember_result, signal_process};
use super::walk;

/// An unreaped child reserves its PID, even if its identity cannot be read.
pub(crate) fn kill_unattached(child: &Child, group: &dyn GroupSignal) -> Result<()> {
    let pid = match i32::try_from(child.id()) {
        Ok(pid) => pid,
        Err(_) => return Err(Error::io(io::Error::other("process id exceeds pid_t"))),
    };
    kill(pid, &SystemTable, group)
}

fn kill(pid: i32, table: &dyn ProcessTable, group: &dyn GroupSignal) -> Result<()> {
    let mut error = None;
    remember_result(&mut error, group.signal(pid, libc::SIGSTOP).map(|_| ()));
    let walk = walk::unattached_descendants(table, pid);
    if let Some(source) = walk.error {
        remember(&mut error, source);
    }
    remember_result(&mut error, group.signal(pid, libc::SIGKILL).map(|_| ()));
    for identity in walk.found {
        remember_result(&mut error, signal_process(table, identity, libc::SIGKILL));
    }
    error.map_or(Ok(()), |source| Err(Error::io(source)))
}

#[cfg(test)]
#[path = "_tests_/unattached_tests.rs"]
mod unattached_tests;
