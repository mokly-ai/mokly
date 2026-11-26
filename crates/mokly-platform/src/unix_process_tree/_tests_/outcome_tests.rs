//! A refused group signal still reaches each live member by its own identity.

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

/// Each signal that the process table sends, in order.
type Signals = Arc<Mutex<Vec<(ProcessIdentity, i32)>>>;

/// The root is exiting and its child is still in a fork, so macOS signals no
/// member of the group, and the walk does not see the child yet.
fn refused_group(refuse: bool) -> (UnixGroup, Signals) {
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let table = Unimock::new((
        IdentityMock
            .each_call(matching!(_))
            .answers(&|_, pid| Ok(Some(if pid == ROOT.pid { ROOT } else { FORKED }))),
        ChildrenMock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Vec::new())),
        SignalMock
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, identity, number| {
                captured.lock().unwrap().push((identity, number));
                if refuse {
                    Err(io::Error::from_raw_os_error(libc::EPERM))
                } else {
                    Ok(())
                }
            })),
    ));
    let groups = Unimock::new(
        GroupSignalMock::signal
            .each_call(matching!(1, _))
            .answers(&|_, _, _| Ok(GroupOutcome::Refused(vec![FORKED.pid]))),
    );
    (
        UnixGroup::new(ROOT, Arc::new(table), Arc::new(groups)),
        signals,
    )
}

#[test]
fn a_refused_group_signal_reaches_each_live_member_by_its_identity() {
    let (group, signals) = refused_group(false);
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
    let (group, _) = refused_group(true);
    let result = ProcessGroup::kill(&group);
    assert!(
        matches!(
            &result,
            Err(Error::Internal(InternalError::Io { source, .. })) if source.raw_os_error() == Some(libc::EPERM)
        ),
        "kill returned {result:?}"
    );
}
