//! Isolated Unix FFI for exclusive rename and process-group signals.

use std::ffi::CString;
use std::io;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Arc;

use crate::error::{Error, Result};
use crate::processes::ProcessGroup;
#[cfg(target_os = "macos")]
use crate::unix_group_members::{self, SystemMembers};
use crate::unix_process_tree::{self, GroupSignal};

/// Renames with Linux `renameat2(RENAME_NOREPLACE)` or macOS
/// `renamex_np(RENAME_EXCL)`, and reads `errno` directly after the call. The
/// outer error is an invalid path; the inner result is the rename's own.
pub(crate) fn exclusive_rename(source: &Path, destination: &Path) -> Result<io::Result<()>> {
    let source = path_string(source)?;
    let destination = path_string(destination)?;
    // SAFETY: Both C strings are NUL-terminated and remain alive for this call.
    // The OS checks paths and performs the no-replace operation atomically.
    #[cfg(target_os = "linux")]
    let result = unsafe {
        libc::renameat2(
            libc::AT_FDCWD,
            source.as_ptr(),
            libc::AT_FDCWD,
            destination.as_ptr(),
            libc::RENAME_NOREPLACE,
        )
    };
    // SAFETY: The owned C strings remain valid; RENAME_EXCL prevents replacement.
    #[cfg(target_os = "macos")]
    let result =
        unsafe { libc::renamex_np(source.as_ptr(), destination.as_ptr(), libc::RENAME_EXCL) };
    Ok(if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    })
}

/// Rejects a path with an interior NUL, which C would read as a shorter path.
fn path_string(path: &Path) -> Result<CString> {
    match CString::new(path.as_os_str().as_bytes()) {
        Ok(path) => Ok(path),
        Err(_) => Err(Error::InvalidPath {
            path: path.to_owned(),
        }),
    }
}

/// Configure a new session and, on Linux, a child subreaper before `execve`.
/// The root can keep zombie children of adopted orphans until it exits.
pub(crate) fn configure(command: &mut Command) {
    // SAFETY: The child runs this async-signal-safe call before exec. A new
    // session gives shells and their descendants one process group.
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 {
                Err(io::Error::last_os_error())
            } else {
                #[cfg(target_os = "linux")]
                {
                    // SAFETY: The child is single-threaded in this pre-exec
                    // hook. The option and arguments are integer constants.
                    let _ = libc::prctl(libc::PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0);
                }
                Ok(())
            }
        });
    }
}

pub(crate) fn attach(child: &Child) -> Result<Box<dyn ProcessGroup>> {
    unix_process_tree::attach(child, Arc::new(SystemGroupSignal))
}

struct SystemGroupSignal;

impl GroupSignal for SystemGroupSignal {
    fn signal(&self, pid: i32, signal: i32) -> io::Result<bool> {
        // SAFETY: The positive child PID identifies the process group created
        // by setsid in the child pre-exec hook. No memory is accessed by kill.
        let result = unsafe { libc::kill(-pid, signal) };
        if result == 0 {
            return Ok(false);
        }
        let source = io::Error::last_os_error();
        if group_is_gone(&source, pid) {
            return Ok(true);
        }
        Err(source)
    }
}

fn group_is_gone(source: &io::Error, pid: i32) -> bool {
    #[cfg(not(target_os = "macos"))]
    let _ = pid;
    if source.raw_os_error() == Some(libc::ESRCH) {
        return true;
    }
    #[cfg(target_os = "macos")]
    if source.raw_os_error() == Some(libc::EPERM) {
        return unix_group_members::stopped(&SystemMembers, pid);
    }
    false
}

#[cfg(test)]
#[path = "_tests_/unix_tests.rs"]
mod unix_tests;
