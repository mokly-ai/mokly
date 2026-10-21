//! Isolated Unix FFI for exclusive rename and process-group signals.

use std::ffi::CString;
use std::io;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Child, Command};

use crate::error::{Error, InternalError, IoResult, Result};
use crate::processes::ProcessGroup;

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

fn path_string(path: &Path) -> Result<CString> {
    match CString::new(path.as_os_str().as_bytes()) {
        Ok(path) => Ok(path),
        Err(_) => Err(Error::InvalidPath {
            path: path.to_owned(),
        }),
    }
}

pub(crate) fn configure(command: &mut Command) {
    // SAFETY: The child runs this async-signal-safe call before exec. A new
    // session gives shells and their descendants one process group.
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 {
                Err(io::Error::last_os_error())
            } else {
                Ok(())
            }
        });
    }
}

pub(crate) fn attach(child: &Child) -> Result<Box<dyn ProcessGroup>> {
    match i32::try_from(child.id()) {
        Ok(pid) => Ok(Box::new(UnixGroup { pid })),
        Err(_) => Err(Error::Internal(InternalError::Io {
            source: io::Error::other("process id exceeds pid_t"),
        })),
    }
}

struct UnixGroup {
    pid: i32,
}

impl UnixGroup {
    fn signal(&self, signal: i32) -> Result<()> {
        // SAFETY: The positive child PID identifies the process group created
        // by setsid in the child pre-exec hook. No memory is accessed by kill.
        let result = unsafe { libc::kill(-self.pid, signal) };
        if result == 0 {
            return Ok(());
        }
        let source = io::Error::last_os_error();
        if group_is_gone(&source, self.pid) {
            return Ok(());
        }
        Err(source).platform()
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
        return crate::unix_group_members::stopped(&crate::unix_group_members::SystemMembers, pid);
    }
    false
}

impl ProcessGroup for UnixGroup {
    fn terminate(&self) -> Result<()> {
        self.signal(libc::SIGTERM)
    }
    fn kill(&self) -> Result<()> {
        self.signal(libc::SIGKILL)
    }
}

#[cfg(test)]
#[path = "_tests_/unix_tests.rs"]
mod unix_tests;
