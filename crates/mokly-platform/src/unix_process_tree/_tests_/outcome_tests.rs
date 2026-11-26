//! A refused group signal still reaches each live member that the membership
//! read confirmed, by the identity from that read.

use std::io;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::error::{Error, InternalError};
use crate::processes::ProcessGroup;
use crate::unix_process_table::{ChildrenMock, IdentityMock, ProcessIdentity, SignalMock};

use super::super::group::{GroupSignalMock, UnixGroup};
use super::GroupOutcome;

const ROOT: ProcessIdentity = ProcessIdentity { pid: 1, start: 10 };
const FORKED: ProcessIdentity = ProcessIdentity { pid: 2, start: 20 };
const SECOND: ProcessIdentity = ProcessIdentity { pid: 3, start: 30 };

/// Each signal that the process table sends, in order.
type Signals = Arc<Mutex<Vec<(ProcessIdentity, i32)>>>;

/// The root is exiting and its children are still in a fork, so macOS signals
/// no member of the group, and the walk does not see the children yet. A new
/// read of a member's ID finds a replacement process, which must get nothing.
/// Each member refuses its own signal when its flag is set.
fn refused_group(members: &[(ProcessIdentity, bool)]) -> (UnixGroup, Signals) {
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let refusing: Vec<_> = members
        .iter()
        .filter(|(_, refuse)| *refuse)
        .map(|(identity, _)| *identity)
        .collect();
    let refused: Vec<_> = members.iter().map(|(identity, _)| *identity).collect();
    let table = Unimock::new((
        IdentityMock.each_call(matching!(_)).answers(&|_, pid| {
            Ok(Some(if pid == ROOT.pid {
                ROOT
            } else {
                ProcessIdentity { pid, start: 99 }
            }))
        }),
        ChildrenMock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Vec::new())),
        SignalMock
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, identity, number| {
                captured.lock().unwrap().push((identity, number));
                if refusing.contains(&identity) {
                    Err(io::Error::from_raw_os_error(libc::EPERM))
                } else {
                    Ok(())
                }
            })),
    ));
    let groups = Unimock::new(
        GroupSignalMock::signal
            .each_call(matching!(1, _))
            .answers_arc(Arc::new(move |_, _, _| {
                Ok(GroupOutcome::Refused(refused.clone()))
            })),
    );
    (
        UnixGroup::new(ROOT, Arc::new(table), Arc::new(groups)),
        signals,
    )
}

#[test]
fn a_refused_group_signal_reaches_each_live_member_by_its_identity() {
    let (group, signals) = refused_group(&[(FORKED, false)]);
    let result = ProcessGroup::terminate(&group);
    assert!(matches!(result, Ok(())), "terminate returned {result:?}");
    assert_eq!(
        *signals.lock().unwrap(),
        [
            (FORKED, libc::SIGSTOP),
            (FORKED, libc::SIGTERM),
            (FORKED, libc::SIGCONT)
        ]
    );
}

#[test]
fn a_member_that_refuses_its_own_signal_keeps_the_error() {
    let (group, signals) = refused_group(&[(FORKED, true), (SECOND, false)]);
    let result = ProcessGroup::kill(&group);
    assert!(
        matches!(
            &result,
            Err(Error::Internal(InternalError::Io { source, .. })) if source.raw_os_error() == Some(libc::EPERM)
        ),
        "kill returned {result:?}"
    );
    assert_eq!(
        *signals.lock().unwrap(),
        [
            (FORKED, libc::SIGSTOP),
            (SECOND, libc::SIGSTOP),
            (FORKED, libc::SIGKILL),
            (SECOND, libc::SIGKILL)
        ],
        "a later member must still get each signal"
    );
}
