//! Darwin libproc adapter with exact return-size checks.

use std::io;
use std::mem::{MaybeUninit, size_of, size_of_val};

use super::Members;

pub(crate) struct SystemMembers;

impl Members for SystemMembers {
    fn list(&self, pgid: i32, pids: &mut [i32]) -> io::Result<usize> {
        let Ok(size) = i32::try_from(size_of_val(pids)) else {
            return Err(io::ErrorKind::InvalidInput.into());
        };
        // SAFETY: errno is thread-local. The mutable slice holds size bytes.
        // proc_listpgrppids returns a PID count, unlike proc_listpids.
        let count = unsafe {
            *libc::__error() = 0;
            libc::proc_listpgrppids(pgid, pids.as_mut_ptr().cast(), size)
        };
        if count < 0 || (count == 0 && io::Error::last_os_error().raw_os_error() != Some(0)) {
            return Err(io::Error::last_os_error());
        }
        Ok(count as usize)
    }

    fn live(&self, pgid: i32, pid: i32) -> io::Result<bool> {
        let mut info = MaybeUninit::<libc::proc_bsdinfo>::uninit();
        let expected = size_of::<libc::proc_bsdinfo>() as i32;
        // SAFETY: libproc receives a correctly aligned buffer of expected bytes.
        let size = unsafe {
            *libc::__error() = 0;
            libc::proc_pidinfo(
                pid,
                libc::PROC_PIDTBSDINFO,
                0,
                info.as_mut_ptr().cast(),
                expected,
            )
        };
        if size != expected {
            let error = io::Error::last_os_error();
            return if error.raw_os_error() == Some(libc::ESRCH) {
                Ok(false)
            } else if error.raw_os_error() == Some(0) {
                Err(io::ErrorKind::UnexpectedEof.into())
            } else {
                Err(error)
            };
        }
        // SAFETY: the full structure was initialized, as the exact size proves.
        let info = unsafe { info.assume_init() };
        Ok(info.pbi_pgid == pgid as u32 && info.pbi_status != libc::SZOMB)
    }
}
