//! Mocked group signals protect cheap cleanup and retained descendant anchors.

use std::io;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::error::{Error, InternalError};
use crate::processes::ProcessGroup;
use crate::unix_process_table::{ChildrenMock, IdentityMock, ProcessIdentity, SignalMock};

use super::{GroupSignalMock, UnixGroup};

const ROOT: ProcessIdentity = ProcessIdentity { pid: 1, start: 10 };
const CHILD: ProcessIdentity = ProcessIdentity { pid: 2, start: 20 };
const LEAF: ProcessIdentity = ProcessIdentity { pid: 3, start: 30 };

#[test]
fn a_reaped_root_with_no_retained_descendants_does_no_table_walk() {
    let reaped = Arc::new(AtomicBool::new(false));
    let root_reaped = Arc::clone(&reaped);
    let reads = Arc::new(AtomicUsize::new(0));
    let captured = Arc::clone(&reads);
    let walks = Arc::new(AtomicUsize::new(0));
    let captured_walks = Arc::clone(&walks);
    let table = Unimock::new((
        IdentityMock
            .some_call(matching!(1))
            .answers_arc(Arc::new(move |_, _| {
                captured.fetch_add(1, Ordering::Relaxed);
                Ok(if root_reaped.load(Ordering::Relaxed) {
                    None
                } else {
                    Some(ROOT)
                })
            })),
        ChildrenMock
            .some_call(matching!(1))
            .answers_arc(Arc::new(move |_, _| {
                captured_walks.fetch_add(1, Ordering::Relaxed);
                Ok(Vec::new())
            })),
    ));
    let signals = Arc::new(AtomicUsize::new(0));
    let captured = Arc::clone(&signals);
    let groups = Unimock::new(
        GroupSignalMock::signal
            .some_call(matching!(1, _))
            .answers_arc(Arc::new(move |_, _, _| {
                captured.fetch_add(1, Ordering::Relaxed);
                Ok(false)
            })),
    );
    let group = UnixGroup::new(ROOT, Arc::new(table), Arc::new(groups));
    ProcessGroup::kill(&group).unwrap();
    assert_eq!(reads.load(Ordering::Relaxed), 3);
    assert_eq!(walks.load(Ordering::Relaxed), 1);
    assert_eq!(signals.load(Ordering::Relaxed), 2);
    reaped.store(true, Ordering::Relaxed);
    reads.store(0, Ordering::Relaxed);
    walks.store(0, Ordering::Relaxed);
    signals.store(0, Ordering::Relaxed);
    ProcessGroup::kill(&group).unwrap();
    assert_eq!(reads.load(Ordering::Relaxed), 2);
    assert_eq!(walks.load(Ordering::Relaxed), 0);
    assert_eq!(signals.load(Ordering::Relaxed), 2);
}

#[test]
fn a_read_failure_still_signals_the_group() {
    let table = Unimock::new(
        IdentityMock
            .some_call(matching!(1))
            .answers(&|_, _| Err(io::ErrorKind::PermissionDenied.into())),
    );
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let groups = Unimock::new(
        GroupSignalMock::signal
            .some_call(matching!(1, _))
            .answers_arc(Arc::new(move |_, _, signal| {
                captured.lock().unwrap().push(signal);
                Ok(false)
            })),
    );
    let group = UnixGroup::new(ROOT, Arc::new(table), Arc::new(groups));
    let kind = match ProcessGroup::kill(&group) {
        Err(Error::Internal(InternalError::Io { source })) => Some(source.kind()),
        _ => None,
    };
    assert_eq!(kind, Some(io::ErrorKind::PermissionDenied));
    assert_eq!(*signals.lock().unwrap(), vec![libc::SIGSTOP, libc::SIGKILL]);
}

#[test]
fn a_reused_root_pid_never_receives_a_group_signal() {
    let reused = Arc::new(AtomicBool::new(false));
    let root_reused = Arc::clone(&reused);
    let table = Unimock::new((
        IdentityMock
            .some_call(matching!(1))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Some(if root_reused.load(Ordering::Relaxed) {
                    ProcessIdentity { pid: 1, start: 11 }
                } else {
                    ROOT
                }))
            })),
        ChildrenMock
            .some_call(matching!(1))
            .answers(&|_, _| Ok(Vec::new())),
    ));
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let groups = Unimock::new(
        GroupSignalMock::signal
            .some_call(matching!(1, _))
            .answers_arc(Arc::new(move |_, _, signal| {
                captured.lock().unwrap().push(signal);
                Ok(false)
            })),
    );
    let group = UnixGroup::new(ROOT, Arc::new(table), Arc::new(groups));
    ProcessGroup::kill(&group).unwrap();
    reused.store(true, Ordering::Relaxed);
    ProcessGroup::kill(&group).unwrap();
    assert_eq!(*signals.lock().unwrap(), vec![libc::SIGSTOP, libc::SIGKILL]);
    assert_eq!(*group.retained.lock().unwrap(), Vec::new());
}

#[test]
fn kill_walks_retained_children_after_the_root_dies() {
    let terminated = Arc::new(AtomicBool::new(false));
    let root_gone = Arc::clone(&terminated);
    let new_leaf = Arc::clone(&terminated);
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let table = Unimock::new((
        IdentityMock
            .some_call(matching!(1))
            .answers_arc(Arc::new(move |_, _| {
                Ok(if root_gone.load(Ordering::Relaxed) {
                    None
                } else {
                    Some(ROOT)
                })
            })),
        IdentityMock
            .some_call(matching!(2))
            .answers(&|_, _| Ok(Some(CHILD))),
        IdentityMock
            .some_call(matching!(3))
            .answers(&|_, _| Ok(Some(LEAF))),
        ChildrenMock
            .some_call(matching!(1))
            .answers(&|_, _| Ok(vec![CHILD])),
        ChildrenMock
            .some_call(matching!(2))
            .answers_arc(Arc::new(move |_, _| {
                Ok(if new_leaf.load(Ordering::Relaxed) {
                    vec![LEAF]
                } else {
                    Vec::new()
                })
            })),
        ChildrenMock
            .some_call(matching!(3))
            .answers(&|_, _| Ok(Vec::new())),
        SignalMock
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, id, signal| {
                captured.lock().unwrap().push((id, signal));
                Ok(())
            })),
    ));
    let groups = Unimock::new(
        GroupSignalMock::signal
            .some_call(matching!(1, _))
            .answers_arc(Arc::new(move |_, _, signal| {
                if signal == libc::SIGTERM {
                    terminated.store(true, Ordering::Relaxed);
                }
                Ok(false)
            })),
    );
    let group = UnixGroup::new(ROOT, Arc::new(table), Arc::new(groups));
    ProcessGroup::terminate(&group).unwrap();
    ProcessGroup::kill(&group).unwrap();
    assert_eq!(
        *signals.lock().unwrap(),
        vec![
            (CHILD, libc::SIGSTOP),
            (CHILD, libc::SIGTERM),
            (CHILD, libc::SIGCONT),
            (CHILD, libc::SIGSTOP),
            (LEAF, libc::SIGSTOP),
            (CHILD, libc::SIGKILL),
            (LEAF, libc::SIGKILL),
        ]
    );
}
