//! Failed attachment cleanup uses the unreaped root and preserves signal errors.

use std::io;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::error::{Error, InternalError};
use crate::unix_process_table::{ChildrenMock, IdentityMock, ProcessIdentity, SignalMock};
use crate::unix_process_tree::GroupOutcome;

use super::super::group::GroupSignalMock;
use super::kill;

const CHILD: ProcessIdentity = ProcessIdentity { pid: 2, start: 20 };

#[test]
fn unattached_cleanup_stops_descendants_without_reading_the_root_identity() {
    let operations = Arc::new(Mutex::new(Vec::new()));
    let captured = operations.clone();
    let table = Unimock::new((
        ChildrenMock
            .some_call(matching!(1))
            .answers(&|_, _| Ok(vec![CHILD])),
        ChildrenMock
            .some_call(matching!(2))
            .answers(&|_, _| Ok(Vec::new())),
        IdentityMock
            .some_call(matching!(2))
            .answers(&|_, _| Ok(Some(CHILD))),
        SignalMock
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, identity, signal| {
                captured.lock().unwrap().push((identity.pid, signal));
                Ok(())
            })),
    ));
    let captured = operations.clone();
    let group = Unimock::new(
        GroupSignalMock::signal
            .some_call(matching!(1, _))
            .answers_arc(Arc::new(move |_, _, signal| {
                captured.lock().unwrap().push((1, signal));
                Ok(GroupOutcome::Delivered)
            })),
    );
    kill(1, &table, &group).unwrap();
    assert_eq!(
        *operations.lock().unwrap(),
        [
            (1, libc::SIGSTOP),
            (2, libc::SIGSTOP),
            (1, libc::SIGKILL),
            (2, libc::SIGKILL)
        ]
    );
}

#[test]
fn unreadable_descendants_still_receive_group_kill_and_preserve_the_first_error() {
    let operations = Arc::new(Mutex::new(Vec::new()));
    let table = Unimock::new(
        ChildrenMock
            .some_call(matching!(1))
            .answers(&|_, _| Err(io::ErrorKind::PermissionDenied.into())),
    );
    let captured = operations.clone();
    let group = Unimock::new(
        GroupSignalMock::signal
            .some_call(matching!(1, _))
            .answers_arc(Arc::new(move |_, _, signal| {
                captured.lock().unwrap().push(signal);
                Err(io::Error::from_raw_os_error(libc::EIO))
            })),
    );
    let result = kill(1, &table, &group);
    println!(
        "unattached cleanup with signal/table errors: {result:?}; signals: {:?}",
        operations.lock().unwrap()
    );
    let code = match result {
        Err(Error::Internal(InternalError::Io { source, .. })) => source.raw_os_error(),
        _ => None,
    };
    assert_eq!(code, Some(libc::EIO));
    assert_eq!(*operations.lock().unwrap(), [libc::SIGSTOP, libc::SIGKILL]);
}
