//! Unix helper liveness treats zombies as gone and permits ten-second waits.

#[cfg(target_os = "linux")]
use std::fs;
use std::io;
#[cfg(target_os = "macos")]
use std::mem::{MaybeUninit, size_of};
use std::time::{Duration, Instant};

/// Check that a helper is live, rather than merely awaiting its reaper.
pub(crate) fn alive(pid: i32) -> bool {
    #[cfg(target_os = "linux")]
    if let Ok(stat) = fs::read_to_string(format!("/proc/{pid}/stat"))
        && stat
            .rsplit_once(')')
            .and_then(|(_, fields)| fields.split_whitespace().next())
            == Some("Z")
    {
        return false;
    }
    #[cfg(target_os = "macos")]
    {
        let mut info = MaybeUninit::<libc::proc_bsdinfo>::uninit();
        let expected = size_of::<libc::proc_bsdinfo>() as i32;
        // SAFETY: The aligned buffer holds exactly expected writable bytes.
        let count = unsafe {
            libc::proc_pidinfo(
                pid,
                libc::PROC_PIDTBSDINFO,
                0,
                info.as_mut_ptr().cast(),
                expected,
            )
        };
        if count == expected {
            // SAFETY: libproc initialized the full structure, as count proves.
            if unsafe { info.assume_init() }.pbi_status == libc::SZOMB {
                return false;
            }
        }
    }
    // SAFETY: Signal zero only queries the reported helper PID.
    let result = unsafe { libc::kill(pid, 0) };
    result == 0 || io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
}

/// Wait for the expected stopped state, with a deadline only as a hang guard.
pub(crate) fn wait_gone(pid: i32) {
    let deadline = Instant::now() + Duration::from_secs(10);
    while alive(pid) && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(10));
    }
    assert!(!alive(pid), "process {pid} remains after the tree stop");
}

/// Kill any surviving helper even when an assertion unwinds the test.
pub(crate) fn kill(pid: i32) {
    // SAFETY: Cleanup targets only a helper PID reported by this test.
    unsafe { libc::kill(pid, libc::SIGKILL) };
}

/// Read a Linux parent PID to prove adoption before the stop starts.
#[cfg(target_os = "linux")]
pub(crate) fn parent(pid: i32) -> i32 {
    fs::read_to_string(format!("/proc/{pid}/stat"))
        .unwrap()
        .rsplit_once(')')
        .unwrap()
        .1
        .split_whitespace()
        .nth(1)
        .unwrap()
        .parse()
        .unwrap()
}
