//! The result of one process-group signal, and the members that a refused
//! group signal must still reach.

use std::io;

use crate::unix_process_table::ProcessTable;

use super::group::{remember, remember_result, signal_process};

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
    Refused(Vec<i32>),
}

/// Return true when the group is gone. A refused group signal goes to each
/// listed member by its own identity, so a member that leaves its fork still
/// gets it. A member that refuses its own signal keeps the error.
pub(super) fn settle(
    outcome: io::Result<GroupOutcome>,
    table: &dyn ProcessTable,
    signal: i32,
) -> io::Result<bool> {
    match outcome? {
        GroupOutcome::Delivered => Ok(false),
        GroupOutcome::Gone => Ok(true),
        GroupOutcome::Refused(members) => {
            let mut first_error = None;
            for pid in members {
                match table.identity(pid) {
                    Ok(Some(identity)) => {
                        remember_result(&mut first_error, signal_process(table, identity, signal))
                    }
                    Ok(None) => {}
                    Err(source) => remember(&mut first_error, source),
                }
            }
            first_error.map_or(Ok(false), Err)
        }
    }
}

#[cfg(test)]
#[path = "_tests_/outcome_tests.rs"]
mod outcome_tests;
