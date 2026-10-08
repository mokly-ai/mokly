//! Snapshot ownership values and injected creation, removal and file boundaries.

use std::path::{Path, PathBuf};

use crate::remote::error::Result;
use crate::remote::git_identity::CommitSha;
use crate::remote::identity::RunId;
use crate::remote::reporting::warning;

/// Resources acquired by a build before it can return or unwind.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Ownership {
    /// No run-specific resource has been created.
    None,
    /// Only the empty snapshot directory belongs to this build.
    Directory,
    /// The directory and temporary index both belong to this build.
    Indexed,
    /// Worktree registration was attempted; remove its admin entry too.
    Linked,
}

/// Owned snapshot resources returned by successful construction.
#[derive(Clone, Debug)]
pub(crate) struct SnapshotHandle {
    /// Detached worktree directory used for synchronization.
    pub(crate) directory: PathBuf,
    /// Adjacent absolute temporary-index path.
    pub(crate) index: PathBuf,
    /// Only these resources may be removed after a partial build.
    pub(crate) ownership: Ownership,
}

impl SnapshotHandle {
    /// Derive paths from a validated run name without touching the filesystem.
    pub(crate) fn paths(workspace: &Path, run: &RunId) -> Self {
        let parent = workspace.join(".context/verification-snapshots");
        Self {
            directory: parent.join(run.as_str()),
            index: parent.join(format!("{run}.index")),
            ownership: Ownership::None,
        }
    }

    /// Keep one diagnostic with all manual cleanup commands for an owned run.
    pub(crate) fn removal_warning(&self, error: &dyn std::fmt::Display) -> String {
        format!(
            "{}; run git worktree remove --force --force {}; git worktree prune; rm -f {}",
            warning("snapshot cleanup failed", error),
            quoted(&self.directory),
            quoted(&self.index)
        )
    }
}

/// Quote a non-secret path for a diagnostic that a developer can copy to a shell.
fn quoted(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', "'\\''"))
}

/// Snapshot lifecycle consumed by the runner through a shared trait object.
#[cfg_attr(test, unimock::unimock(api = [SnapshotCreateMock, SnapshotRemoveMock]))]
pub(crate) trait Snapshot: Send + Sync {
    /// Reserve fresh paths, build the snapshot and clean partial state on error or panic.
    fn create(&self, run: &RunId, base: &CommitSha) -> Result<SnapshotHandle>;
    /// Attempt every owned cleanup step; callers only warn about a returned error.
    fn remove(&self, snapshot: &SnapshotHandle) -> Result<()>;
}

/// Filesystem ownership operations kept separate from unit-tested orchestration.
#[cfg_attr(test, unimock::unimock(api = [SnapshotFilesParentMock, SnapshotFilesAbsentMock, SnapshotFilesDirectoryMock, SnapshotFilesIndexMock, SnapshotFilesRemoveDirectoryMock, SnapshotFilesRemoveIndexMock]))]
pub(crate) trait SnapshotFiles: Send + Sync {
    /// Create the shared snapshot parent before any temporary-index write.
    fn parent(&self, workspace: &Path) -> Result<()>;
    /// Reject an existing path, including a broken symbolic link.
    fn absent(&self, path: &Path) -> Result<()>;
    /// Exclusively create one empty snapshot directory.
    fn directory(&self, path: &Path) -> Result<()>;
    /// Exclusively create one empty temporary-index file.
    fn index(&self, path: &Path) -> Result<()>;
    /// Remove only a directory owned by this build before worktree registration.
    fn remove_directory(&self, path: &Path) -> Result<()>;
    /// Remove only this run's owned temporary index, including an already-gone file.
    fn remove_index(&self, path: &Path) -> Result<()>;
}
