//! Bounded, identity-checked descendant walks for Unix process trees.

use std::io;

use crate::unix_process_table::{ProcessIdentity, ProcessTable};

/// Maximum number of parent-link walks for one signal operation.
pub(super) const MAX_WALKS: usize = 64;

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
pub(super) fn descendants(
    table: &dyn ProcessTable,
    root: ProcessIdentity,
    retained: &[ProcessIdentity],
) -> WalkResult {
    let mut found = retained.to_vec();
    let mut error = None;
    for &identity in retained {
        if live(table, identity, &mut error) {
            stop(table, identity, &mut error);
        }
    }
    let mut anchors = Vec::with_capacity(retained.len() + 1);
    anchors.push(root);
    anchors.extend_from_slice(&found);
    for _ in 0..MAX_WALKS {
        let mut added = false;
        let current_anchors = anchors.clone();
        for anchor in current_anchors {
            if !live(table, anchor, &mut error) {
                continue;
            }
            let children = match table.children(anchor.pid) {
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
                if !live(table, child, &mut error) {
                    continue;
                }
                stop(table, child, &mut error);
                found.push(child);
                anchors.push(child);
                added = true;
            }
        }
        if !added {
            return WalkResult { found, error };
        }
    }
    remember(
        &mut error,
        io::Error::other("Unix descendant walk exceeded its bound"),
    );
    WalkResult { found, error }
}

fn live(
    table: &dyn ProcessTable,
    identity: ProcessIdentity,
    error: &mut Option<io::Error>,
) -> bool {
    match table.identity(identity.pid) {
        Ok(current) => current == Some(identity),
        Err(source) => {
            remember(error, source);
            false
        }
    }
}

fn stop(table: &dyn ProcessTable, identity: ProcessIdentity, error: &mut Option<io::Error>) {
    if let Err(source) = table.signal(identity, libc::SIGSTOP)
        && source.raw_os_error() != Some(libc::ESRCH)
    {
        remember(error, source);
    }
}

fn remember(slot: &mut Option<io::Error>, source: io::Error) {
    if slot.is_none() {
        *slot = Some(source);
    }
}

#[cfg(test)]
#[path = "_tests_/walk_tests.rs"]
mod walk_tests;
