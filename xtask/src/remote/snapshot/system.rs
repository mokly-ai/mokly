//! Non-cancellable Git snapshot adapter with injected filesystem ownership.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::remote::clients::outcome::success;
use crate::remote::contracts::{Output, Reporter};
use crate::remote::error::{Error, Operation, Result};
use crate::remote::git_identity::CommitSha;
use crate::remote::identity::RunId;
use crate::remote::process::{Process, Request};
use crate::remote::snapshot::construction::ConstructionGuard;
use crate::remote::snapshot::contracts::{Ownership, Snapshot, SnapshotFiles, SnapshotHandle};

/// Real snapshot adapter composed only at the CLI boundary.
pub(crate) struct SystemSnapshot {
    /// Shell-free process host with shared secret removal.
    pub(crate) process: Arc<dyn Process + Send + Sync>,
    /// Exclusive path reservation and file removal.
    pub(crate) files: Arc<dyn SnapshotFiles + Send + Sync>,
    /// Best-effort cleanup diagnostics.
    pub(crate) reporter: Arc<dyn Reporter + Send + Sync>,
    /// Absolute checkout location.
    pub(crate) workspace: PathBuf,
}

impl Snapshot for SystemSnapshot {
    fn create(&self, run: &RunId, base: &CommitSha) -> Result<SnapshotHandle> {
        let handle = SnapshotHandle::paths(&self.workspace, run);
        self.files.parent(&self.workspace)?;
        self.files.absent(&handle.directory)?;
        self.files.absent(&handle.index)?;
        let mut guard = ConstructionGuard {
            adapter: self,
            reporter: &*self.reporter,
            handle,
            armed: true,
        };
        self.files.directory(&guard.handle.directory)?;
        guard.handle.ownership = Ownership::Directory;
        self.files.index(&guard.handle.index)?;
        guard.handle.ownership = Ownership::Indexed;
        let index = Some(guard.handle.index.clone());
        self.git(
            vec!["read-tree".into(), "HEAD".into()],
            &self.workspace,
            index.clone(),
        )?;
        self.git(
            vec!["add".into(), "-A".into()],
            &self.workspace,
            index.clone(),
        )?;
        let output = self.git(vec!["write-tree".into()], &self.workspace, index)?;
        let tree = CommitSha::read(&output.stdout)?;
        guard.handle.ownership = Ownership::Linked;
        self.git(
            vec![
                "-c".into(),
                "core.hooksPath=/dev/null".into(),
                "worktree".into(),
                "add".into(),
                "--detach".into(),
                guard.handle.directory.to_string_lossy().into_owned(),
                base.as_str().into(),
            ],
            &self.workspace,
            None,
        )?;
        self.git(
            vec![
                "read-tree".into(),
                "-u".into(),
                "--reset".into(),
                tree.as_str().into(),
            ],
            &guard.handle.directory,
            None,
        )?;
        self.git(
            vec!["read-tree".into(), base.as_str().into()],
            &guard.handle.directory,
            None,
        )?;
        Ok(guard.complete())
    }

    fn remove(&self, snapshot: &SnapshotHandle) -> Result<()> {
        self.remove_owned(snapshot)
    }
}

impl SystemSnapshot {
    /// Execute snapshot Git operations as non-cancellable, separate-argument requests.
    pub(super) fn git(
        &self,
        args: Vec<String>,
        cwd: &Path,
        git_index: Option<PathBuf>,
    ) -> Result<Output> {
        let output = self.process.execute(&Request {
            program: "git".into(),
            args,
            cwd: cwd.to_owned(),
            operation: Operation::Git,
            input: None,
            log: None,
            cancellable: false,
            blacksmith: false,
            git_index,
        })?;
        if let Err(source) = success(&output, Operation::Git) {
            return Err(Error::Captured {
                source: Box::new(source),
                output,
            });
        }
        Ok(output)
    }
}

#[cfg(test)]
#[path = "_tests_/snapshot_adapter_tests.rs"]
mod snapshot_adapter_tests;

#[cfg(test)]
#[path = "_tests_/system_tests.rs"]
mod system_tests;
