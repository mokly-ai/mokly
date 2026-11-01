//! macOS libproc process-table adapter.

use std::io;
use std::mem::{MaybeUninit, size_of, size_of_val};

use super::{ProcessIdentity, ProcessTable};

/// macOS process-table implementation.
pub(crate) struct SystemTable;

impl ProcessTable for SystemTable {
    fn identity(&self, pid: i32) -> io::Result<Option<ProcessIdentity>> {
        match info(pid) {
            Ok(info) => Ok(Some(identity(pid, &info))),
            Err(error) if error.raw_os_error() == Some(libc::ESRCH) => Ok(None),
            Err(error) => Err(error),
        }
    }

    fn children(&self, pid: i32) -> io::Result<Vec<ProcessIdentity>> {
        let mut pids = vec![0_i32; 256];
        loop {
            let count = proc_list_children(pid, &mut pids)?;
            if count >= pids.len() {
                let Some(capacity) = pids.len().checked_mul(2) else {
                    return Err(io::ErrorKind::OutOfMemory.into());
                };
                pids.resize(capacity, 0);
                continue;
            }
            let mut children = Vec::new();
            for &child in &pids[..count] {
                match info(child) {
                    Ok(info) if info.pbi_ppid == pid as u32 => {
                        children.push(identity(child, &info));
                    }
                    Ok(_) => {}
                    Err(error) if error.raw_os_error() == Some(libc::ESRCH) => {}
                    Err(error) => return Err(error),
                }
            }
            children.sort_unstable_by_key(|identity| identity.pid);
            children.dedup();
            return Ok(children);
        }
    }

    fn signal(&self, identity: ProcessIdentity, signal: i32) -> io::Result<()> {
        if self.identity(identity.pid)? != Some(identity) {
            return Ok(());
        }
        // SAFETY: The positive PID was identity-checked immediately before
        // this call. kill reads no process memory.
        if unsafe { libc::kill(identity.pid, signal) } == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }
}

fn identity(pid: i32, info: &libc::proc_bsdinfo) -> ProcessIdentity {
    ProcessIdentity {
        pid,
        start: u128::from(info.pbi_start_tvsec) * 1_000_000 + u128::from(info.pbi_start_tvusec),
    }
}

/// Include exited children until reaping so fast commands can still attach.
/// XNU enables zombie lookup when the BSD-info argument is nonzero.
fn info(pid: i32) -> io::Result<libc::proc_bsdinfo> {
    let mut info = MaybeUninit::<libc::proc_bsdinfo>::uninit();
    let expected = size_of::<libc::proc_bsdinfo>() as i32;
    // SAFETY: libproc receives a correctly aligned buffer of the exact size.
    let bytes = unsafe {
        *libc::__error() = 0;
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDTBSDINFO,
            1,
            info.as_mut_ptr().cast(),
            expected,
        )
    };
    if bytes != expected {
        let error = io::Error::last_os_error();
        return if error.raw_os_error() == Some(0) {
            Err(io::ErrorKind::UnexpectedEof.into())
        } else {
            Err(error)
        };
    }
    // SAFETY: libproc reported the exact structure size, so every field is
    // initialized.
    Ok(unsafe { info.assume_init() })
}

/// `proc_listchildpids` returns a PID count, unlike `proc_listpids`.
fn proc_list_children(pid: i32, pids: &mut [i32]) -> io::Result<usize> {
    let Ok(bytes) = i32::try_from(size_of_val(pids)) else {
        return Err(io::ErrorKind::InvalidInput.into());
    };
    // SAFETY: errno is thread-local. The mutable slice has the exact byte size.
    let result = unsafe {
        *libc::__error() = 0;
        libc::proc_listchildpids(pid, pids.as_mut_ptr().cast(), bytes)
    };
    if result < 0 {
        return Err(io::Error::last_os_error());
    }
    if result == 0 {
        let error = io::Error::last_os_error();
        if error.raw_os_error() != Some(0) {
            return Err(error);
        }
    }
    Ok(result as usize)
}
