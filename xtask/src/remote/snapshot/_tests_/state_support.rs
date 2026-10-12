//! Independent working-tree and checkout-state captures for real Git tests.

use std::collections::BTreeMap;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use crate::remote::git_adapter_support::Repository;

/// Checkout identities that snapshot construction must not change.
#[derive(Debug, Eq, PartialEq)]
pub(super) struct CheckoutState {
    /// Full checkout commit SHA.
    head: String,
    /// Exact index bytes, including staged content.
    index: Vec<u8>,
    /// Whole non-ignored status inventory.
    status: String,
    /// Registered worktrees and their HEADs.
    worktrees: String,
    /// Full reflog after temporary worktree removal.
    reflog: String,
    /// Symbolic branch name or detached HEAD marker.
    reference: String,
}

/// Capture status before index bytes because Git can refresh its stat cache.
pub(super) fn checkout(repository: &Repository) -> CheckoutState {
    let status = repository.git(&["status", "--porcelain=v1", "--untracked-files=all"]);
    CheckoutState {
        head: repository.head().to_string(),
        index: fs::read(repository.root.join(".git/index")).unwrap(),
        status,
        worktrees: repository.git(&["worktree", "list", "--porcelain"]),
        reflog: repository.git(&["reflog", "--all"]),
        reference: repository.git(&["rev-parse", "--symbolic-full-name", "HEAD"]),
    }
}

/// Read path, mode and bytes independently of Git's staged tree objects.
pub(super) fn files(repository: &Repository, root: &Path) -> BTreeMap<PathBuf, (u32, Vec<u8>)> {
    let listing = repository.at(
        root,
        &[
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ],
    );
    let mut files = BTreeMap::new();
    for name in listing.split('\0').filter(|name| !name.is_empty()) {
        let path = root.join(name);
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            continue;
        };
        let entry = if metadata.is_symlink() {
            (
                0o120000,
                fs::read_link(&path)
                    .unwrap()
                    .to_string_lossy()
                    .as_bytes()
                    .to_vec(),
            )
        } else {
            #[cfg(unix)]
            let executable = metadata.permissions().mode() & 0o111 != 0;
            #[cfg(not(unix))]
            let executable = false;
            (
                if executable { 0o100755 } else { 0o100644 },
                fs::read(path).unwrap(),
            )
        };
        files.insert(PathBuf::from(name), entry);
    }
    files
}
