//! Isolated Unix FFI for exclusive rename and process-group signals.

use std::ffi::CString;
use std::io;
use std::mem::MaybeUninit;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::process::{CommandExt, ExitStatusExt};
use std::path::Path;
use std::process::{Child, Command, ExitStatus};
use std::sync::Arc;

use crate::error::{Error, Result};
use crate::processes::ProcessGroup;
#[cfg(target_os = "macos")]
use crate::unix_group_members::{self, SystemMembers};
use crate::unix_process_tree::{self, GroupOutcome, GroupSignal};

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
/// Subreaping keeps orphans inside the owned tree reachable through parent
/// links while the manager runs, including children in other sessions.
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

/// Start a helper-free child in its own group without a hook that forces fork.
pub(crate) fn configure_plain(command: &mut Command) {
    command.process_group(0);
}

/// Capture the root identity before the caller can reap its child.
pub(crate) fn attach(child: &Child) -> Result<Box<dyn ProcessGroup>> {
    unix_process_tree::attach(child, Arc::new(SystemGroupSignal))
}

/// The caller keeps the child unreaped while its PID anchors cleanup.
pub(crate) fn kill_unattached(child: &Child) -> Result<()> {
    unix_process_tree::kill_unattached(child, &SystemGroupSignal)
}

/// Block until the child exits, and leave it unreaped. `WNOWAIT` keeps the
/// zombie, so its PID and its group number stay reserved until the reap.
pub(crate) fn wait_exit(pid: u32) -> io::Result<ExitStatus> {
    loop {
        let mut info = MaybeUninit::<libc::siginfo_t>::zeroed();
        // SAFETY: The PID names our own unreaped child. The zeroed buffer has
        // the exact siginfo_t size and stays alive for the call. WNOWAIT
        // reports the exit without reaping the child.
        let result = unsafe {
            libc::waitid(
                libc::P_PID,
                pid,
                info.as_mut_ptr(),
                libc::WEXITED | libc::WNOWAIT,
            )
        };
        if result == 0 {
            // SAFETY: The buffer started zeroed, a valid siginfo_t value, and
            // the successful call wrote the record of the exited child.
            let info = unsafe { info.assume_init() };
            return exit_status(&info);
        }
        let source = io::Error::last_os_error();
        if source.kind() != io::ErrorKind::Interrupted {
            return Err(source);
        }
    }
}

/// Rebuild the wait status that `waitpid` would return from a child record.
fn exit_status(info: &libc::siginfo_t) -> io::Result<ExitStatus> {
    // SAFETY: waitid filled the child fields of this record for WEXITED.
    let status = unsafe { info.si_status() };
    let raw = match info.si_code {
        libc::CLD_EXITED => (status & 0xff) << 8,
        libc::CLD_KILLED => status & 0x7f,
        libc::CLD_DUMPED => (status & 0x7f) | 0x80,
        _ => return Err(io::Error::other("waitid reported no child exit")),
    };
    Ok(ExitStatus::from_raw(raw))
}

struct SystemGroupSignal;

impl GroupSignal for SystemGroupSignal {
    fn signal(&self, pid: i32, signal: i32) -> io::Result<GroupOutcome> {
        // SAFETY: The positive child PID identifies the process group created
        // by setsid or Command::process_group. No memory is accessed by kill.
        let result = unsafe { libc::kill(-pid, signal) };
        if result == 0 {
            return Ok(GroupOutcome::Delivered);
        }
        refused(io::Error::last_os_error(), pid)
    }
}

/// Classify a failed group signal. On macOS, the member reader decides what a
/// refusal leaves behind. Other hosts answer EPERM only for a real refusal.
fn refused(source: io::Error, pid: i32) -> io::Result<GroupOutcome> {
    #[cfg(target_os = "macos")]
    return unix_group_members::classify(&SystemMembers, source, pid);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = pid;
        if source.raw_os_error() == Some(libc::ESRCH) {
            return Ok(GroupOutcome::Gone);
        }
        Err(source)
    }
}

#[cfg(test)]
#[path = "_tests_/unix_tests.rs"]
mod unix_tests;
