//! Parent-owned linked checkout and isolated test-process environment.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::child_environment::{GIT_REPOSITORY_VARIABLES, SECRET_VARIABLES};
use crate::remote::git_adapter_support::Repository;

use self::environment_child::exercise;

#[path = "environment_child.rs"]
mod environment_child;

/// Re-execution marker, scoped to this test rather than the shared Cargo process.
const CHILD_MARKER: &str = "MOKLY_XTASK_SNAPSHOT_ENV_CHILD";

/// Only state owned by the parent checkout may survive the child unchanged.
#[derive(Debug, Eq, PartialEq)]
struct Checkout {
    /// Current commit identity.
    head: String,
    /// Exact staged-state bytes.
    index: Vec<u8>,
    /// Staged and unstaged status entries.
    status: String,
    /// Common repository configuration bytes.
    config: Vec<u8>,
    /// Registered worktrees and their heads.
    worktrees: String,
}

/// Capture status before reading the index, after Git's normal refresh.
fn checkout(repository: &Repository, workspace: &Path, git_directory: &Path) -> Checkout {
    let status = repository.at(workspace, &["status", "--porcelain=v1"]);
    Checkout {
        head: repository.at(workspace, &["rev-parse", "HEAD"]),
        index: fs::read(git_directory.join("index")).unwrap(),
        status,
        config: fs::read(repository.root.join(".git/config")).unwrap(),
        worktrees: repository.git(&["worktree", "list", "--porcelain"]),
    }
}

/// Run a real snapshot child, then require all parent-owned state to be preserved.
pub(super) fn regression(test_name: &str, work_tree: bool) {
    if env::var(CHILD_MARKER).as_deref() == Ok(test_name) {
        exercise(work_tree);
        return;
    }
    let repository = Repository::new();
    let base = repository.head();
    repository.push("feature");
    let workspace = repository.root.parent().unwrap().join("linked checkout");
    repository.git(&[
        "worktree",
        "add",
        "-b",
        "hook-checkout",
        workspace.to_str().unwrap(),
        base.as_str(),
    ]);
    fs::write(workspace.join("unpushed"), "unpushed work\n").unwrap();
    repository.at(&workspace, &["add", "unpushed"]);
    repository.at(&workspace, &["commit", "-m", "test: unpushed work"]);
    fs::write(workspace.join("staged"), "staged work\n").unwrap();
    repository.at(&workspace, &["add", "staged"]);
    let git_directory = PathBuf::from(
        repository
            .at(&workspace, &["rev-parse", "--absolute-git-dir"])
            .trim(),
    );
    assert!(git_directory.is_absolute());
    assert!(git_directory.starts_with(repository.root.parent().unwrap()));
    let before = checkout(&repository, &workspace, &git_directory);
    assert_eq!(before.status, "A  staged\n");
    let mut command = Command::new(env::current_exe().unwrap());
    command.args([
        "--exact",
        &format!("remote::snapshot::system::environment_adapter_tests::{test_name}"),
        "--nocapture",
    ]);
    for name in GIT_REPOSITORY_VARIABLES.iter().chain(SECRET_VARIABLES) {
        command.env_remove(name);
    }
    command
        .env(CHILD_MARKER, test_name)
        .env("MOKLY_XTASK_SNAPSHOT_CHECKOUT", &workspace)
        .env("MOKLY_XTASK_SNAPSHOT_BASE", base.as_str())
        .env("GIT_DIR", &git_directory);
    if work_tree {
        command.env("GIT_WORK_TREE", &workspace);
    }
    let output = command.output().unwrap();
    let after = checkout(&repository, &workspace, &git_directory);
    assert!(
        output.status.success(),
        "stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("snapshot held expected files"));
    assert_eq!(before.head, after.head, "checkout HEAD changed");
    assert_eq!(before.index, after.index, "checkout index changed");
    assert_eq!(before.status, after.status, "checkout status changed");
    assert_eq!(before.config, after.config, "repository config changed");
    assert_eq!(before.worktrees, after.worktrees, "worktree list changed");
    assert!(
        !fs::read_dir(workspace.join(".context/verification-snapshots"))
            .unwrap()
            .any(|entry| entry.is_ok())
    );
}
