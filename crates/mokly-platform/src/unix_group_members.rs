//! Read the members of a process group after macOS refuses a group signal.

use std::io;

use crate::unix_process_table::ProcessIdentity;

#[cfg(target_os = "macos")]
mod system;
#[cfg(target_os = "macos")]
pub(super) use system::SystemMembers;

/// The state of one member of a process group.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[expect(
    unreachable_pub,
    reason = "the generated mock of a crate-private trait names this type in a public interface"
)]
pub enum Member {
    /// A missing PID, a zombie, or a process of another group.
    Gone,
    /// A process that has begun to exit and needs no signal.
    Exiting,
    /// A process that still needs the signal, with the identity of the
    /// same read that showed its membership.
    Live(ProcessIdentity),
}

#[cfg_attr(test, unimock::unimock(api = MembersMock))]
/// Process membership boundary used only after a refused group signal.
pub(super) trait Members {
    /// Return the number of PIDs written, not a byte count.
    fn list(&self, pgid: i32, pids: &mut [i32]) -> io::Result<usize>;
    /// Read the state of one listed member of the group.
    fn state(&self, pgid: i32, pid: i32) -> io::Result<Member>;
}

/// What a refused group signal leaves behind.
#[derive(Debug, Eq, PartialEq)]
pub(super) enum Refusal {
    /// No member remains, so the group is gone.
    Stopped,
    /// Members remain. These live members still need the signal.
    Pending(Vec<ProcessIdentity>),
}

/// Read a refused group only after a complete, readable enumeration.
/// Return `None` when a list or a state cannot be read.
pub(super) fn refusal(members: &dyn Members, pgid: i32) -> Option<Refusal> {
    let mut pids = vec![0; 256];
    loop {
        let count = members.list(pgid, &mut pids).ok()?;
        if count >= pids.len() {
            let capacity = pids.len().checked_mul(2)?;
            pids.resize(capacity, 0);
            continue;
        }
        let mut present = false;
        let mut live = Vec::new();
        for pid in &pids[..count] {
            match members.state(pgid, *pid).ok()? {
                Member::Gone => {}
                Member::Exiting => present = true,
                Member::Live(identity) => live.push(identity),
            }
        }
        if !present && live.is_empty() {
            return Some(Refusal::Stopped);
        }
        return Some(Refusal::Pending(live));
    }
}

#[cfg(test)]
#[path = "_tests_/unix_group_members_tests.rs"]
mod unix_group_members_tests;
