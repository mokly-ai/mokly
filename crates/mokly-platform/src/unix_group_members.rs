//! Confirm that a group has no live members before accepting macOS EPERM.

use std::io;

#[cfg(target_os = "macos")]
mod system;
#[cfg(target_os = "macos")]
pub(super) use system::SystemMembers;

#[cfg_attr(test, unimock::unimock(api = MembersMock))]
/// Process membership boundary used only after a refused group signal.
pub(super) trait Members {
    /// Return the number of PIDs written, not a byte count.
    fn list(&self, pgid: i32, pids: &mut [i32]) -> io::Result<usize>;
    /// A missing PID or a zombie is not a live member of this group.
    fn live(&self, pgid: i32, pid: i32) -> io::Result<bool>;
}

/// Accept a stopped group only after a complete, readable enumeration.
pub(super) fn stopped(members: &dyn Members, pgid: i32) -> bool {
    let mut pids = vec![0; 256];
    loop {
        let Ok(count) = members.list(pgid, &mut pids) else {
            return false;
        };
        if count >= pids.len() {
            let Some(capacity) = pids.len().checked_mul(2) else {
                return false;
            };
            pids.resize(capacity, 0);
            continue;
        }
        return pids[..count]
            .iter()
            .all(|pid| matches!(members.live(pgid, *pid), Ok(false)));
    }
}

#[cfg(test)]
#[path = "_tests_/unix_group_members_tests.rs"]
mod unix_group_members_tests;
