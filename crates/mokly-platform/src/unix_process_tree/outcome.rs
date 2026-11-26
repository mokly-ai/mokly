//! The result of one process-group signal, and the members that a refused
//! group signal must still reach.

use std::io;

use crate::unix_process_table::{ProcessIdentity, ProcessTable};

use super::group::{GroupSignal, remember_result, signal_process};

/// The result of one signal to an owned process group.
#[derive(Clone, Debug, Eq, PartialEq)]
#[expect(
    unreachable_pub,
    reason = "the generated mock of a crate-private trait names this type in a public interface"
)]
pub enum GroupOutcome {
    /// The signal reached a live group.
    Delivered,
    /// The group has no live member.
    Gone,
    /// The kernel signalled no member, but these members are live and still
    /// need the signal. macOS refuses a group signal with EPERM while each
    /// member is exiting or still in a fork.
    #[cfg_attr(
        all(not(target_os = "macos"), not(test)),
        expect(dead_code, reason = "only the macOS group signal reports a refusal")
    )]
    Refused(Vec<ProcessIdentity>),
}

/// Send one signal to the group and finish it. Every caller uses this, so no
/// caller can drop the members that a refused group signal still needs.
/// Return true when the group is gone.
pub(super) fn send(
    group: &dyn GroupSignal,
    table: &dyn ProcessTable,
    pid: i32,
    signal: i32,
) -> io::Result<bool> {
    match group.signal(pid, signal)? {
        GroupOutcome::Delivered => Ok(false),
        GroupOutcome::Gone => Ok(true),
        GroupOutcome::Refused(members) => {
            let mut first_error = None;
            for identity in members {
                remember_result(&mut first_error, signal_process(table, identity, signal));
            }
            first_error.map_or(Ok(false), Err)
        }
    }
}

#[cfg(test)]
#[path = "_tests_/outcome_tests.rs"]
mod outcome_tests;
