//! Linux `/proc` process-table adapter and pidfd signal boundary.

use std::fs;
use std::io;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::path::PathBuf;

use super::{ProcessIdentity, ProcessTable};

/// Linux process-table implementation.
pub(crate) struct SystemTable;

impl ProcessTable for SystemTable {
    fn identity(&self, pid: i32) -> io::Result<Option<ProcessIdentity>> {
        match read_stat(pid) {
            Ok(stat) => Ok(Some(stat.identity)),
            Err(error) if error.raw_os_error() == Some(libc::ENOENT) => Ok(None),
            Err(error) => Err(error),
        }
    }

    fn children(&self, pid: i32) -> io::Result<Vec<ProcessIdentity>> {
        let mut missing_children_files = false;
        let task_dir = PathBuf::from(format!("/proc/{pid}/task"));
        let tasks = match fs::read_dir(&task_dir) {
            Ok(tasks) => tasks,
            Err(error) if error.raw_os_error() == Some(libc::ENOENT) => return Ok(Vec::new()),
            Err(error) => return Err(error),
        };
        let mut children = Vec::new();
        for entry in tasks {
            let entry = entry?;
            let path = entry.path().join("children");
            match fs::read_to_string(path) {
                Ok(text) => {
                    for child in text.split_whitespace() {
                        let Ok(child) = child.parse::<i32>() else {
                            continue;
                        };
                        if let Some(identity) = self.identity(child)? {
                            children.push(identity);
                        }
                    }
                }
                Err(error) if error.raw_os_error() == Some(libc::ENOENT) => {
                    missing_children_files = true;
                }
                Err(error) => return Err(error),
            }
        }
        if missing_children_files {
            return scan_children(pid);
        }
        children.sort_unstable_by_key(|identity| identity.pid);
        children.dedup();
        Ok(children)
    }

    fn signal(&self, identity: ProcessIdentity, signal: i32) -> io::Result<()> {
        if self.identity(identity.pid)? != Some(identity) {
            return Ok(());
        }
        send_signal(identity.pid, signal)
    }
}

#[derive(Clone, Copy)]
struct Stat {
    identity: ProcessIdentity,
    parent: i32,
}

fn read_stat(pid: i32) -> io::Result<Stat> {
    let path = format!("/proc/{pid}/stat");
    let text = fs::read_to_string(path)?;
    let Some((_, fields)) = text.rsplit_once(')') else {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Linux process stat has no closing name delimiter",
        ));
    };
    let fields = fields.split_whitespace().collect::<Vec<_>>();
    let Some(parent) = fields.get(1).and_then(|value| value.parse().ok()) else {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Linux process stat has no parent field",
        ));
    };
    let Some(start) = fields.get(19).and_then(|value| value.parse::<u64>().ok()) else {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Linux process stat has no start-time field",
        ));
    };
    Ok(Stat {
        identity: ProcessIdentity {
            pid,
            start: start as u128,
        },
        parent,
    })
}

fn scan_children(parent: i32) -> io::Result<Vec<ProcessIdentity>> {
    let mut children = Vec::new();
    let entries = match fs::read_dir("/proc") {
        Ok(entries) => entries,
        Err(error) => return Err(error),
    };
    for entry in entries {
        let entry = entry?;
        let Some(pid) = entry
            .file_name()
            .to_str()
            .and_then(|value| value.parse().ok())
        else {
            continue;
        };
        match read_stat(pid) {
            Ok(stat) if stat.parent == parent => children.push(stat.identity),
            Ok(_) => {}
            Err(error) if error.raw_os_error() == Some(libc::ENOENT) => {}
            Err(error) => return Err(error),
        }
    }
    children.sort_unstable_by_key(|identity| identity.pid);
    children.dedup();
    Ok(children)
}

fn send_signal(pid: i32, signal: i32) -> io::Result<()> {
    match pidfd_signal(pid, signal) {
        Ok(()) => Ok(()),
        Err(error) if error.raw_os_error() == Some(libc::ENOSYS) => {
            // SAFETY: The positive PID is checked by the caller immediately
            // before this call. kill reads no process memory.
            if unsafe { libc::kill(pid, signal) } == 0 {
                Ok(())
            } else {
                Err(io::Error::last_os_error())
            }
        }
        Err(error) => Err(error),
    }
}

fn pidfd_signal(pid: i32, signal: i32) -> io::Result<()> {
    // SAFETY: pidfd_open receives a valid PID and zero flags. The returned
    // descriptor is owned only after the syscall reports a nonnegative value.
    let fd = unsafe { libc::syscall(libc::SYS_pidfd_open, pid, 0) };
    if fd < 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: The syscall returned a fresh descriptor owned by this function.
    let fd = unsafe { OwnedFd::from_raw_fd(fd as i32) };
    // SAFETY: The live pidfd identifies the process instance. A null siginfo
    // pointer and zero flags request the documented direct signal operation.
    let result = unsafe {
        libc::syscall(
            libc::SYS_pidfd_send_signal,
            fd.as_raw_fd(),
            signal,
            std::ptr::null::<libc::siginfo_t>(),
            0,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}
