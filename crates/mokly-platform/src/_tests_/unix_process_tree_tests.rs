//! Mocked group signals for Unix ownership orchestration.

use std::io;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::processes::ProcessGroup;
use crate::unix_process_table::{ProcessIdentity, ProcessTableMock};

use super::{GroupSignalMock, UnixGroup};

#[test]
fn a_reaped_root_with_no_retained_descendants_does_no_table_walk() {
    let calls = Arc::new(Mutex::new(0_u32));
    let table_calls = Arc::clone(&calls);
    let children_calls = Arc::clone(&calls);
    let signal_calls = Arc::clone(&calls);
    let table = Unimock::new((
        ProcessTableMock::identity
            .each_call(matching!(_))
            .answers(&move |_, _| {
                *table_calls.lock().unwrap() += 1;
                Ok(None)
            }),
        ProcessTableMock::children
            .each_call(matching!(_))
            .answers(&move |_, _| {
                *children_calls.lock().unwrap() += 1;
                Ok(Vec::new())
            }),
        ProcessTableMock::signal
            .each_call(matching!(_, _))
            .answers(&move |_, _, _| {
                *signal_calls.lock().unwrap() += 1;
                Ok(())
            }),
    ));
    let groups = Unimock::new(
        GroupSignalMock::signal
            .each_call(matching!(1, _))
            .answers(&|_, _, _| Ok(true)),
    );
    let group = UnixGroup::new(
        ProcessIdentity { pid: 1, start: 10 },
        Arc::new(table),
        Arc::new(groups),
    );
    ProcessGroup::kill(&group).unwrap();
    assert_eq!(*calls.lock().unwrap(), 0);
}

#[test]
fn a_read_failure_still_signals_the_group() {
    let table = Unimock::new(
        ProcessTableMock::identity
            .next_call(matching!(1))
            .answers(&|_, _| Err(io::ErrorKind::PermissionDenied.into())),
    );
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let groups = Unimock::new(
        GroupSignalMock::signal
            .each_call(matching!(1, _))
            .answers(&move |_, _, signal| {
                captured.lock().unwrap().push(signal);
                Ok(false)
            }),
    );
    let group = UnixGroup::new(
        ProcessIdentity { pid: 1, start: 10 },
        Arc::new(table),
        Arc::new(groups),
    );
    assert!(ProcessGroup::kill(&group).is_err());
    assert_eq!(*signals.lock().unwrap(), vec![libc::SIGSTOP, libc::SIGKILL]);
}
