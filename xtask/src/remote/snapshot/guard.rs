//! Runner-owned snapshot lifetime with non-panicking, single-attempt removal.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};

use crate::remote::contracts::{Dependencies, Reporter};
use crate::remote::error::{Error, Result};
use crate::remote::git_identity::CommitSha;
use crate::remote::identity::RunId;
use crate::remote::snapshot::contracts::{Snapshot, SnapshotHandle};

/// A runner phase can acquire a snapshot without owning concrete adapters.
pub(in crate::remote) trait SnapshotOwner: Send + Sync {
    /// Build, track and return the synchronization directory.
    fn create(&self, run: &RunId, base: &CommitSha) -> Result<PathBuf>;
    /// Remove the tracked snapshot once; failures only produce a warning.
    fn finish(&self);
}

/// The cleanup owner stays alive before construction through every runner exit.
pub(in crate::remote) struct SnapshotGuard {
    /// Injected snapshot operations.
    snapshot: Arc<dyn Snapshot + Send + Sync>,
    /// Best-effort cleanup warnings.
    reporter: Arc<dyn Reporter + Send + Sync>,
    /// The handle is taken before removal to prevent repeated attempts.
    remaining: Mutex<Option<SnapshotHandle>>,
}

impl SnapshotGuard {
    /// Construct an empty owner before any snapshot can be built.
    pub(in crate::remote) fn new(dependencies: &Dependencies) -> Self {
        Self {
            snapshot: dependencies.snapshot.clone(),
            reporter: dependencies.reporter.clone(),
            remaining: Mutex::new(None),
        }
    }

    /// Recover ownership after a poisoned lock without another panic.
    fn remaining(&self) -> MutexGuard<'_, Option<SnapshotHandle>> {
        match self.remaining.lock() {
            Ok(state) => state,
            Err(poisoned) => poisoned.into_inner(),
        }
    }
}

impl SnapshotOwner for SnapshotGuard {
    fn create(&self, run: &RunId, base: &CommitSha) -> Result<PathBuf> {
        let handle = self.snapshot.create(run, base)?;
        let directory = handle.directory.clone();
        *self.remaining() = Some(handle);
        Ok(directory)
    }

    fn finish(&self) {
        let handle = self.remaining().take();
        let Some(handle) = handle else {
            return;
        };
        let _ = catch_unwind(AssertUnwindSafe(|| {
            let result = match catch_unwind(AssertUnwindSafe(|| self.snapshot.remove(&handle))) {
                Ok(result) => result,
                Err(_) => Err(Error::Worker),
            };
            if let Err(error) = result {
                self.reporter.executor(&handle.removal_warning(&error));
            }
        }));
    }
}

impl Drop for SnapshotGuard {
    fn drop(&mut self) {
        let _ = catch_unwind(AssertUnwindSafe(|| self.finish()));
    }
}
