//! Bounded, identity-checked descendant walks for Unix process trees.

use std::io;

use super::super::unix_process_table::{ProcessIdentity, ProcessTable};

/// Maximum number of parent-link walks for one signal operation.
pub(super) const MAX_WALKS: usize = 64;

/// Descendants found before a walk error or walk bound.
pub(crate) struct WalkResult {
    /// Process identities that the caller must signal.
    pub(crate) found: Vec<ProcessIdentity>,
    /// First process-table error, if the full tree was not readable.
    pub(crate) error: Option<io::Error>,
}

/// Stop and collect every identity reachable through parent links.
pub(crate) fn descendants(
    table: &dyn ProcessTable,
    root: ProcessIdentity,
    retained: &[ProcessIdentity],
) -> WalkResult {
    let mut found = retained.to_vec();
    let mut anchors = Vec::with_capacity(retained.len() + 1);
    anchors.push(root);
    anchors.extend_from_slice(retained);
    let mut error = None;
    for _ in 0..MAX_WALKS {
        let mut added = false;
        let current_anchors = anchors.clone();
        for anchor in current_anchors {
            let live = match table.identity(anchor.pid) {
                Ok(Some(current)) => current == anchor,
                Ok(None) => false,
                Err(source) => {
                    remember(&mut error, source);
                    false
                }
            };
            if !live {
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
                let current = match table.identity(child.pid) {
                    Ok(Some(current)) if current == child => current,
                    Ok(_) => continue,
                    Err(source) => {
                        remember(&mut error, source);
                        continue;
                    }
                };
                if let Err(source) = table.signal(current, libc::SIGSTOP)
                    && source.raw_os_error() != Some(libc::ESRCH)
                {
                    remember(&mut error, source);
                }
                found.push(current);
                anchors.push(current);
                added = true;
            }
        }
        if !added {
            return WalkResult { found, error };
        }
    }
    remember(
        &mut error,
        io::Error::new(
            io::ErrorKind::Other,
            "Unix descendant walk exceeded its bound",
        ),
    );
    WalkResult { found, error }
}

fn remember(slot: &mut Option<io::Error>, source: io::Error) {
    if slot.is_none() {
        *slot = Some(source);
    }
}
