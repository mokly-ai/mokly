//! Darwin libproc adapter. A member's state comes from the same process
//! record reader as the process table, so its identity matches the walk.

use std::io;
use std::mem::size_of_val;

use crate::unix_process_table::{bsd_identity, bsd_info};

use super::{Member, Members};

/// `PROC_FLAG_INEXIT` of `<sys/proc_info.h>`: the process has begun to exit.
const PROC_FLAG_INEXIT: u32 = 4;

/// Darwin process table queries, including members reaped during inspection.
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

    fn state(&self, pgid: i32, pid: i32) -> io::Result<Member> {
        let info = match bsd_info(pid) {
            Ok(info) => info,
            Err(error) if error.raw_os_error() == Some(libc::ESRCH) => return Ok(Member::Gone),
            Err(error) => return Err(error),
        };
        if info.pbi_pgid != pgid as u32 || info.pbi_status == libc::SZOMB {
            Ok(Member::Gone)
        } else if info.pbi_flags & PROC_FLAG_INEXIT != 0 {
            Ok(Member::Exiting)
        } else {
            Ok(Member::Live(bsd_identity(pid, &info)))
        }
    }
}
