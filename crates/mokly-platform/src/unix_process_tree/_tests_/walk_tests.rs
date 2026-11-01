//! Mocked parent links protect identity checks and bounded descendant walks.

use std::io;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::unix_process_table::{ChildrenMock, IdentityMock, ProcessIdentity, SignalMock};

use super::descendants;

const ROOT: ProcessIdentity = ProcessIdentity { pid: 1, start: 10 };
const CHILD: ProcessIdentity = ProcessIdentity { pid: 2, start: 20 };
const LEAF: ProcessIdentity = ProcessIdentity { pid: 3, start: 30 };

/// A finite tree's depth must not consume the allowance for repeat passes.
#[test]
fn a_deep_chain_is_stopped_completely_without_a_bound_error() {
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let reads = Arc::new(AtomicUsize::new(0));
    let captured_reads = Arc::clone(&reads);
    let table = Unimock::new((
        IdentityMock
            .some_call(matching!(_))
            .answers(&|_, pid| Ok(Some(ProcessIdentity { pid, start: 10 }))),
        ChildrenMock
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, pid| {
                captured_reads.fetch_add(1, Ordering::Relaxed);
                Ok(if pid <= 200 {
                    vec![ProcessIdentity {
                        pid: pid + 1,
                        start: 10,
                    }]
                } else {
                    Vec::new()
                })
            })),
        SignalMock
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, identity, signal| {
                captured.lock().unwrap().push((identity, signal));
                Ok(())
            })),
    ));
    let result = descendants(&table, ROOT, &[]);
    let expected: Vec<_> = (2..=201)
        .map(|pid| ProcessIdentity { pid, start: 10 })
        .collect();
    assert_eq!(result.found, expected);
    assert_eq!(result.error.map(|error| error.kind()), None);
    assert_eq!(reads.load(Ordering::Relaxed), 402);
    assert_eq!(
        *signals.lock().unwrap(),
        expected
            .into_iter()
            .map(|identity| (identity, libc::SIGSTOP))
            .collect::<Vec<_>>()
    );
}

#[test]
fn a_reused_pid_is_ignored() {
    let table = Unimock::new((
        IdentityMock
            .some_call(matching!(1))
            .answers(&|_, _| Ok(Some(ROOT))),
        ChildrenMock
            .some_call(matching!(1))
            .answers(&|_, _| Ok(vec![CHILD])),
        IdentityMock
            .some_call(matching!(2))
            .answers(&|_, _| Ok(Some(ProcessIdentity { pid: 2, start: 21 }))),
    ));
    let result = descendants(&table, ROOT, &[]);
    assert_eq!(result.error.map(|error| error.kind()), None);
    assert_eq!(result.found, Vec::new());
}

#[test]
fn a_walk_repeats_until_no_new_child_appears() {
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let reads = Arc::new(AtomicUsize::new(0));
    let captured_reads = Arc::clone(&reads);
    let table = Unimock::new((
        IdentityMock
            .some_call(matching!(1))
            .answers(&|_, _| Ok(Some(ROOT))),
        IdentityMock
            .some_call(matching!(2))
            .answers(&|_, _| Ok(Some(CHILD))),
        IdentityMock
            .some_call(matching!(3))
            .answers(&|_, _| Ok(Some(LEAF))),
        ChildrenMock
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, pid| {
                captured_reads.fetch_add(1, Ordering::Relaxed);
                Ok(match pid {
                    1 => vec![CHILD],
                    2 => vec![LEAF],
                    _ => Vec::new(),
                })
            })),
        SignalMock
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, id, signal| {
                captured.lock().unwrap().push((id, signal));
                Ok(())
            })),
    ));
    let result = descendants(&table, ROOT, &[]);
    assert_eq!(result.error.map(|error| error.kind()), None);
    assert_eq!(result.found, vec![CHILD, LEAF]);
    assert_eq!(reads.load(Ordering::Relaxed), 6);
    assert_eq!(
        *signals.lock().unwrap(),
        vec![(CHILD, libc::SIGSTOP), (LEAF, libc::SIGSTOP)]
    );
}

#[test]
fn process_table_read_errors_are_returned() {
    let table = Unimock::new(
        IdentityMock
            .some_call(matching!(1))
            .answers(&|_, _| Err(io::ErrorKind::PermissionDenied.into())),
    );
    let result = descendants(&table, ROOT, &[]);
    assert_eq!(
        result.error.map(|error| error.kind()),
        Some(io::ErrorKind::PermissionDenied)
    );
}

/// Each pass adds a finite subtree after earlier root scans have completed.
#[test]
fn a_growing_tree_stops_at_the_pass_bound() {
    let passes = Arc::new(AtomicUsize::new(0));
    let captured_passes = Arc::clone(&passes);
    let signals = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&signals);
    let table = Unimock::new((
        IdentityMock
            .some_call(matching!(_))
            .answers(&|_, pid| Ok(Some(ProcessIdentity { pid, start: 10 }))),
        ChildrenMock
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, pid| {
                Ok(if pid == 1 {
                    let count = captured_passes.fetch_add(1, Ordering::Relaxed) + 1;
                    (0..count)
                        .map(|index| ProcessIdentity {
                            pid: 2 + 2 * index as i32,
                            start: 10,
                        })
                        .collect()
                } else if pid % 2 == 0 {
                    vec![ProcessIdentity {
                        pid: pid + 1,
                        start: 10,
                    }]
                } else {
                    Vec::new()
                })
            })),
        SignalMock
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, identity, signal| {
                captured.lock().unwrap().push((identity, signal));
                Ok(())
            })),
    ));
    let result = descendants(&table, ROOT, &[]);
    let expected: Vec<_> = (2..=129)
        .map(|pid| ProcessIdentity { pid, start: 10 })
        .collect();
    assert_eq!(result.found.len(), 128);
    assert_eq!(result.found, expected);
    assert_eq!(passes.load(Ordering::Relaxed), 64);
    assert_eq!(
        result.error.map(|error| error.kind()),
        Some(io::ErrorKind::Other)
    );
    assert_eq!(
        *signals.lock().unwrap(),
        expected
            .into_iter()
            .map(|identity| (identity, libc::SIGSTOP))
            .collect::<Vec<_>>()
    );
}
