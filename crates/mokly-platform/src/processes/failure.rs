//! A failed attachment gives back its child only after the stop of its tree.

use std::process::Child;

use crate::error::{Error, Result};
use crate::processes::ProcessGroups;

/// A failed attachment and the unreaped child that it holds. No guard exists.
/// The only way to the child is [`AttachFailure::stop`], which first stops the
/// whole tree with [`ProcessGroups::kill_unattached`]. So no caller can reap
/// the child while its descendants still run unstopped.
#[derive(Debug, thiserror::Error)]
#[error("[platform] could not attach the process tree")]
pub struct AttachFailure {
    child: Child,
    #[source]
    source: Error,
}

/// The child of a failed attachment after the stop of its tree.
#[derive(Debug)]
pub struct Unattached {
    /// The unreaped child. The caller kills and reaps it.
    pub child: Child,
    /// The cause of the failed attachment.
    pub source: Error,
    /// The result of the tree stop.
    pub stopped: Result<()>,
}

impl AttachFailure {
    /// Hold the unreaped child of a failed attachment and its cause.
    /// Implementations of `ProcessGroups::attach` return it.
    pub fn new(child: Child, source: Error) -> Self {
        Self { child, source }
    }

    /// Stop the whole tree of the child with `kill_unattached`, and then give
    /// back the child, the cause, and the result of the stop.
    pub fn stop(self, groups: &dyn ProcessGroups) -> Unattached {
        let stopped = groups.kill_unattached(&self.child);
        Unattached {
            child: self.child,
            source: self.source,
            stopped,
        }
    }
}
