//! Isolated Windows FFI for exclusive rename and kill-on-close jobs.

use std::io;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Child, Command};
use std::ptr::null;

use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
use windows_sys::Win32::Storage::FileSystem::MoveFileExW;
use windows_sys::Win32::System::Console::GenerateConsoleCtrlEvent;
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, TH32CS_SNAPTHREAD, THREADENTRY32, Thread32First, Thread32Next,
};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
    SetInformationJobObject, TerminateJobObject,
};
use windows_sys::Win32::System::Threading::{
    CREATE_NEW_PROCESS_GROUP, CREATE_SUSPENDED, OpenThread, ResumeThread, THREAD_SUSPEND_RESUME,
};

use crate::error::{Error, IoResult, Result};
use crate::processes::ProcessGroup;

pub(crate) fn exclusive_rename(source: &Path, destination: &Path) -> Result<io::Result<()>> {
    let source = wide_path(source)?;
    let destination = wide_path(destination)?;
    // SAFETY: Both vectors hold valid NUL-terminated UTF-16 paths for this
    // call. Zero flags prohibit replacement of an existing destination.
    let result = unsafe { MoveFileExW(source.as_ptr(), destination.as_ptr(), 0) };
    Ok(if result != 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    })
}

fn wide_path(path: &Path) -> Result<Vec<u16>> {
    let mut text: Vec<u16> = path.as_os_str().encode_wide().collect();
    if text.contains(&0) {
        return Err(Error::InvalidPath {
            path: path.to_owned(),
        });
    }
    text.push(0);
    Ok(text)
}

pub(crate) fn configure(command: &mut Command) {
    command.creation_flags(CREATE_NEW_PROCESS_GROUP | CREATE_SUSPENDED);
}

pub(crate) fn attach(child: &Child) -> Result<Box<dyn ProcessGroup>> {
    // SAFETY: Null attributes and name request an unnamed job with defaults.
    let raw = unsafe { CreateJobObjectW(null(), null()) };
    if raw.is_null() {
        return Err(io::Error::last_os_error()).platform();
    }
    // SAFETY: CreateJobObjectW returned a new owned kernel handle.
    let job = unsafe { OwnedHandle::from_raw_handle(raw) };
    // SAFETY: This Windows POD structure permits an all-zero initial value.
    let mut information: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { zeroed() };
    information.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    // SAFETY: The handle is live and the pointer and size match the exact
    // information class. The child handle stays alive throughout assignment.
    let configured = unsafe {
        SetInformationJobObject(
            job.as_raw_handle(),
            JobObjectExtendedLimitInformation,
            &information as *const _ as *const _,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
    };
    if configured == 0 {
        return Err(io::Error::last_os_error()).platform();
    }
    // SAFETY: Both handles remain owned and valid for this call.
    if unsafe { AssignProcessToJobObject(job.as_raw_handle(), child.as_raw_handle()) } == 0 {
        return Err(io::Error::last_os_error()).platform();
    }
    resume_primary_thread(child.id())?;
    Ok(Box::new(WindowsGroup {
        job,
        pid: child.id(),
    }))
}

struct WindowsGroup {
    job: OwnedHandle,
    pid: u32,
}

impl ProcessGroup for WindowsGroup {
    fn terminate(&self) -> Result<()> {
        // SAFETY: CTRL_BREAK_EVENT (1) is sent to the child's new console group.
        if unsafe { GenerateConsoleCtrlEvent(1, self.pid) } == 0 {
            return self.kill();
        }
        Ok(())
    }

    fn kill(&self) -> Result<()> {
        // SAFETY: The job handle is live and owns this command's child tree.
        if unsafe { TerminateJobObject(self.job.as_raw_handle(), 1) } == 0 {
            return Err(io::Error::last_os_error()).platform();
        }
        Ok(())
    }
}

fn resume_primary_thread(pid: u32) -> Result<()> {
    // SAFETY: This query takes no borrowed pointers. The returned handle is
    // checked against the documented invalid sentinel before ownership starts.
    let raw = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0) };
    if raw == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error()).platform();
    }
    // SAFETY: The snapshot is a new owned kernel handle and is not the sentinel.
    let snapshot = unsafe { OwnedHandle::from_raw_handle(raw) };
    // SAFETY: THREADENTRY32 is a Windows POD structure with a valid zero state.
    let mut entry: THREADENTRY32 = unsafe { zeroed() };
    entry.dwSize = size_of::<THREADENTRY32>() as u32;
    // SAFETY: The snapshot is live; entry has the documented size and storage.
    let mut present = unsafe { Thread32First(snapshot.as_raw_handle(), &mut entry) };
    while present != 0 {
        if entry.th32OwnerProcessID == pid {
            // SAFETY: The child is suspended and has only its primary thread.
            // OpenThread returns an independently owned handle on success.
            let raw = unsafe { OpenThread(THREAD_SUSPEND_RESUME, 0, entry.th32ThreadID) };
            if raw.is_null() {
                return Err(io::Error::last_os_error()).platform();
            }
            // SAFETY: OpenThread returned a new valid kernel handle.
            let thread = unsafe { OwnedHandle::from_raw_handle(raw) };
            // SAFETY: Assignment to the kill-on-close job completed before this
            // resume. The live thread handle grants THREAD_SUSPEND_RESUME.
            if unsafe { ResumeThread(thread.as_raw_handle()) } == u32::MAX {
                return Err(io::Error::last_os_error()).platform();
            }
            return Ok(());
        }
        // SAFETY: Both the snapshot and output structure remain valid.
        present = unsafe { Thread32Next(snapshot.as_raw_handle(), &mut entry) };
    }
    Err(io::Error::new(
        io::ErrorKind::NotFound,
        "suspended child primary thread was not found",
    ))
    .platform()
}
