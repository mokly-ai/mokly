//! Mocked process-table adapters used by Unix descendant-walk tests.

use std::io;

use unimock::{MockFn, Unimock, matching};

use super::{ProcessIdentity, ProcessTableMock};

#[test]
fn a_reused_pid_is_ignored() {
    let root = ProcessIdentity { pid: 1, start: 10 };
    let old_child = ProcessIdentity { pid: 2, start: 20 };
    let reused_child = ProcessIdentity { pid: 2, start: 21 };
    let table = Unimock::new((
        ProcessTableMock::identity
            .next_call(matching!(1))
            .answers(&|_, _| Ok(Some(root))),
        ProcessTableMock::children
            .next_call(matching!(1))
            .answers(&|_, _| Ok(vec![old_child])),
        ProcessTableMock::identity
            .next_call(matching!(2))
            .answers(&|_, _| Ok(Some(reused_child))),
    ));
    let result = crate::unix_process_tree::walk::descendants(&table, root, &[]);
    assert!(result.error.is_none());
    assert!(result.found.is_empty());
}

#[test]
fn a_walk_repeats_until_no_new_child_appears() {
    let root = ProcessIdentity { pid: 1, start: 10 };
    let child = ProcessIdentity { pid: 2, start: 20 };
    let table = Unimock::new((
        ProcessTableMock::identity
            .each_call(matching!(1))
            .answers(&|_, _| Ok(Some(root))),
        ProcessTableMock::identity
            .each_call(matching!(2))
            .answers(&|_, _| Ok(Some(child))),
        ProcessTableMock::children
            .next_call(matching!(1))
            .answers(&|_, _| Ok(vec![child])),
        ProcessTableMock::children
            .next_call(matching!(1))
            .answers(&|_, _| Ok(Vec::new())),
        ProcessTableMock::children
            .next_call(matching!(2))
            .answers(&|_, _| Ok(Vec::new())),
        ProcessTableMock::signal
            .next_call(matching!(child, libc::SIGSTOP))
            .answers(&|_, _, _| Ok(())),
    ));
    let result = crate::unix_process_tree::walk::descendants(&table, root, &[]);
    assert!(result.error.is_none());
    assert_eq!(result.found, vec![child]);
}

#[test]
fn process_table_read_errors_are_returned() {
    let root = ProcessIdentity { pid: 1, start: 10 };
    let table = Unimock::new(
        ProcessTableMock::identity
            .next_call(matching!(1))
            .answers(&|_, _| Err(io::ErrorKind::PermissionDenied.into())),
    );
    let result = crate::unix_process_tree::walk::descendants(&table, root, &[]);
    assert_eq!(
        result.error.map(|error| error.kind()),
        Some(io::ErrorKind::PermissionDenied)
    );
}
