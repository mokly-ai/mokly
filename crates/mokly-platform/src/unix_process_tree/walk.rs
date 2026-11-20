//! Bounded, identity-checked descendant walks for Unix process trees.

use std::collections::VecDeque;
use std::io;

use crate::unix_process_table::{ProcessIdentity, ProcessTable};

/// Maximum complete queue passes for one signal, independent of tree depth.
pub(super) const MAX_PASSES: usize = 64;

/// Descendants found before a walk error or walk bound.
pub(super) struct WalkResult {
    /// Process identities that the caller must signal.
    pub(super) found: Vec<ProcessIdentity>,
    /// First process-table error, if the full tree was not readable.
    pub(super) error: Option<io::Error>,
}

/// Stop and collect every identity reachable through parent links.
/// The caller stops the root's group first. Retained identities remain walk
/// anchors after their original parent exits.
/// Each pass scans new descendants immediately. Complete passes repeat to
/// catch changed parent links, including orphans adopted by a subreaper.
pub(super) fn descendants(
    table: &dyn ProcessTable,
    root: ProcessIdentity,
    retained: &[ProcessIdentity],
) -> WalkResult {
    walk(table, Anchor::Identity(root), retained)
}

/// The borrowed, unreaped root reserves its PID without an identity read.
pub(super) fn unattached_descendants(table: &dyn ProcessTable, pid: i32) -> WalkResult {
    walk(table, Anchor::Unreaped(pid), &[])
}

#[derive(Clone, Copy)]
enum Anchor {
    Identity(ProcessIdentity),
    Unreaped(i32),
}

impl Anchor {
    fn pid(self) -> i32 {
        match self {
            Self::Identity(identity) => identity.pid,
            Self::Unreaped(pid) => pid,
        }
    }
}

fn walk(table: &dyn ProcessTable, root: Anchor, retained: &[ProcessIdentity]) -> WalkResult {
    let mut found = retained.to_vec();
    let mut error = None;
    for &identity in retained {
        if live(table, Anchor::Identity(identity), &mut error) {
            stop(table, identity, &mut error);
        }
    }
    let mut anchors = Vec::with_capacity(retained.len() + 1);
    anchors.push(root);
    anchors.extend(found.iter().copied().map(Anchor::Identity));
    for _ in 0..MAX_PASSES {
        let mut added = false;
        let mut pending: VecDeque<_> = anchors.iter().copied().collect();
        while let Some(anchor) = pending.pop_front() {
            if !live(table, anchor, &mut error) {
                continue;
            }
            let children = match table.children(anchor.pid()) {
                Ok(children) => children,
                Err(source) => {
                    remember(&mut error, source);
                    continue;
                }
            };
            for child in children {
                if found.contains(&child) {
                    continue;
                }
                if !live(table, Anchor::Identity(child), &mut error) {
                    continue;
                }
                stop(table, child, &mut error);
                found.push(child);
                anchors.push(Anchor::Identity(child));
                pending.push_back(Anchor::Identity(child));
                added = true;
            }
        }
        if !added {
            return WalkResult { found, error };
        }
    }
    remember(
        &mut error,
        io::Error::other("Unix descendant walk exceeded its pass bound"),
    );
    WalkResult { found, error }
}

/// Confirm the same process instance immediately before the caller scans it.
fn live(table: &dyn ProcessTable, anchor: Anchor, error: &mut Option<io::Error>) -> bool {
    let Anchor::Identity(identity) = anchor else {
        return true;
    };
    match table.identity(identity.pid) {
        Ok(current) => current == Some(identity),
        Err(source) => {
            remember(error, source);
            false
        }
    }
}

/// Stop a confirmed descendant before it can add more children to the queue.
fn stop(table: &dyn ProcessTable, identity: ProcessIdentity, error: &mut Option<io::Error>) {
    if let Err(source) = table.signal(identity, libc::SIGSTOP)
        && source.raw_os_error() != Some(libc::ESRCH)
    {
        remember(error, source);
    }
}

/// Preserve the first failure while the walk continues through other anchors.
fn remember(slot: &mut Option<io::Error>, source: io::Error) {
    if slot.is_none() {
        *slot = Some(source);
    }
}

#[cfg(test)]
#[path = "_tests_/walk_tests.rs"]
mod walk_tests;
