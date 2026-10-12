//! Partial-build ownership guard that also removes resources during unwinding.

use std::panic::{AssertUnwindSafe, catch_unwind};

use crate::remote::contracts::Reporter;
use crate::remote::error::Error;
use crate::remote::snapshot::contracts::{Snapshot, SnapshotHandle};

/// Borrowed cleanup owner installed before reserving either run-specific path.
pub(super) struct ConstructionGuard<'a> {
    /// Adapter responsible for partial resource removal.
    pub(super) adapter: &'a dyn Snapshot,
    /// Best-effort warning destination.
    pub(super) reporter: &'a dyn Reporter,
    /// Current acquired resources, never including a foreign collision path.
    pub(super) handle: SnapshotHandle,
    /// Successful construction transfers cleanup responsibility to the runner.
    pub(super) armed: bool,
}

impl ConstructionGuard<'_> {
    /// Transfer ownership only after every build step succeeds.
    pub(super) fn complete(mut self) -> SnapshotHandle {
        self.armed = false;
        self.handle.clone()
    }
}

impl Drop for ConstructionGuard<'_> {
    fn drop(&mut self) {
        if !self.armed {
            return;
        }
        let _ = catch_unwind(AssertUnwindSafe(|| {
            let outcome = match catch_unwind(AssertUnwindSafe(|| self.adapter.remove(&self.handle)))
            {
                Ok(outcome) => outcome,
                Err(_) => Err(Error::Worker),
            };
            if let Err(error) = outcome {
                self.reporter.executor(&self.handle.removal_warning(&error));
            }
        }));
    }
}
