//! macOS libproc process-table adapter.

use std::io;
use std::mem::{MaybeUninit, size_of};

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
            let bytes = proc_list_children(pid, &mut pids)?;
            if bytes == pids.len() * size_of::<i32>() {
                let Some(capacity) = pids.len().checked_mul(2) else {
                    return Err(io::ErrorKind::OutOfMemory.into());
                };
                pids.resize(capacity, 0);
                continue;
            }
            if bytes % size_of::<i32>() != 0 {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "libproc returned a partial child PID",
                ));
            }
            let mut children = Vec::new();
            for &child in &pids[..bytes / size_of::<i32>()] {
                if let Some(identity) = self.identity(child)? {
                    children.push(identity);
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
        start: (info.pbi_start_tvsec as u128) * 1_000_000 + info.pbi_start_tvusec as u128,
    }
}

fn info(pid: i32) -> io::Result<libc::proc_bsdinfo> {
    let mut info = MaybeUninit::<libc::proc_bsdinfo>::uninit();
    let expected = size_of::<libc::proc_bsdinfo>() as i32;
    // SAFETY: libproc receives a correctly aligned buffer of the exact size.
    let bytes = unsafe {
        *libc::__error() = 0;
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDTBSDINFO,
            0,
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

fn proc_list_children(pid: i32, pids: &mut [i32]) -> io::Result<usize> {
    let bytes = (pids.len() * size_of::<i32>()) as i32;
    // SAFETY: The mutable PID slice is valid for the exact byte capacity.
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
