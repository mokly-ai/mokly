//! Real Git snapshot contents, exact request safety and exclusive path ownership.

use std::fs;
#[cfg(unix)]
use std::os::unix::fs::{PermissionsExt, symlink};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::ReporterExecutorMock;
use crate::remote::error::Error;
use crate::remote::git_adapter_support::Repository;
use crate::remote::identity::RunId;
use crate::remote::snapshot::contracts::{Snapshot, SnapshotFiles, SnapshotHandle};
use crate::remote::snapshot::filesystem::SystemSnapshotFiles;
use crate::remote::snapshot::system::SystemSnapshot;

use self::state_support::{checkout, files};

#[path = "state_support.rs"]
mod state_support;

/// One distinct source-tree change exercised in an isolated checkout.
#[derive(Clone, Copy, Debug)]
enum Change {
    /// Remove a path present in the pushed base.
    Deletion,
    /// Move a tracked path to a new path.
    Rename,
    /// Add a non-ignored file absent from the index.
    Untracked,
    /// Preserve both staged and later unstaged content in the checkout.
    Staged,
    /// Exercise construction when the checkout has no symbolic branch.
    Detached,
    /// Preserve executable permission bits on POSIX hosts.
    #[cfg(unix)]
    Mode,
    /// Preserve symbolic-link targets without following them.
    #[cfg(unix)]
    Symlink,
}

/// Construct the real adapter with an unrestricted best-effort test reporter.
fn adapter(repository: &Repository) -> SystemSnapshot {
    SystemSnapshot {
        process: repository.process.clone(),
        files: Arc::new(SystemSnapshotFiles),
        reporter: Arc::new(
            Unimock::new(ReporterExecutorMock.each_call(matching!(_)).returns(()))
                .no_verify_in_drop(),
        ),
        workspace: repository.root.clone(),
    }
}

/// Build a controlled working-tree difference while retaining a real index.
fn change(repository: &Repository, change: Change) {
    let tracked = repository.root.join("tracked");
    match change {
        Change::Deletion => fs::remove_file(tracked).unwrap(),
        Change::Rename => fs::rename(tracked, repository.root.join("renamed")).unwrap(),
        Change::Untracked => fs::write(repository.root.join("untracked"), "untracked\n").unwrap(),
        Change::Staged => {
            fs::write(&tracked, "staged\n").unwrap();
            fs::write(repository.root.join("staged-new"), "new staged file\n").unwrap();
            repository.git(&["add", "tracked", "staged-new"]);
            fs::write(tracked, "working tree after staging\n").unwrap();
        }
        Change::Detached => {
            repository.git(&["switch", "--detach"]);
            fs::write(tracked, "detached checkout\n").unwrap();
        }
        #[cfg(unix)]
        Change::Mode => fs::set_permissions(tracked, fs::Permissions::from_mode(0o755)).unwrap(),
        #[cfg(unix)]
        Change::Symlink => {
            fs::remove_file(&tracked).unwrap();
            symlink("m1", tracked).unwrap();
        }
    }
}

/// Every supported file change survives while HEAD, index, status and worktrees stay intact.
#[test]
fn snapshot_copies_each_change_and_preserves_the_checkout_after_removal() {
    for scenario in [
        Change::Deletion,
        Change::Rename,
        Change::Untracked,
        Change::Staged,
        Change::Detached,
        #[cfg(unix)]
        Change::Mode,
        #[cfg(unix)]
        Change::Symlink,
    ] {
        let repository = Repository::new();
        let base = repository.commit("tracked");
        repository.commit("head-only");
        change(&repository, scenario);
        let initial = checkout(&repository);
        let expected = files(&repository, &repository.root);
        let snapshot = adapter(&repository);
        let handle = snapshot
            .create(&RunId::new("20261006T120000Z", 42).unwrap(), &base)
            .unwrap();
        assert_eq!(
            repository
                .at(&handle.directory, &["rev-parse", "HEAD"])
                .trim(),
            base.as_str()
        );
        assert_eq!(
            files(&repository, &handle.directory),
            expected,
            "{scenario:?}"
        );
        assert!(
            repository
                .at(&handle.directory, &["diff", "--cached", "--name-only"])
                .is_empty()
        );
        let status = repository.at(
            &handle.directory,
            &["status", "--porcelain=v1", "--untracked-files=all"],
        );
        assert!(
            status
                .lines()
                .all(|line| line.starts_with("??") || line.starts_with(' '))
        );
        snapshot.remove(&handle).unwrap();
        assert!(!handle.directory.exists());
        assert!(!handle.index.exists());
        assert_eq!(checkout(&repository), initial, "{scenario:?}");
    }
}

/// Real Git receives an adjacent temporary index only for the first three build requests.
#[test]
fn snapshot_git_requests_disable_hooks_scope_index_and_never_cancel() {
    let repository = Repository::new();
    let base = repository.head();
    repository.clear_requests();
    let snapshot = adapter(&repository);
    let handle = snapshot
        .create(&RunId::new("20261006T120000Z", 43).unwrap(), &base)
        .unwrap();
    snapshot.remove(&handle).unwrap();
    let requests = repository.process.requests.lock().unwrap();
    let tree = requests[4].args.last().unwrap();
    let directory = handle.directory.to_str().unwrap();
    let expected: Vec<Vec<&str>> = vec![
        vec!["read-tree", "HEAD"],
        vec!["add", "-A"],
        vec!["write-tree"],
        vec![
            "-c",
            "core.hooksPath=/dev/null",
            "worktree",
            "add",
            "--detach",
            directory,
            base.as_str(),
        ],
        vec!["read-tree", "-u", "--reset", tree],
        vec!["read-tree", base.as_str()],
        vec!["worktree", "remove", "--force", "--force", directory],
        vec!["worktree", "prune"],
    ];
    assert_eq!(requests.len(), expected.len());
    for (index, (request, args)) in requests.iter().zip(expected).enumerate() {
        assert_eq!(request.args, args);
        assert_eq!(request.git_index, (index < 3).then(|| handle.index.clone()));
        assert_eq!(
            request.cwd,
            if matches!(index, 4 | 5) {
                handle.directory.clone()
            } else {
                repository.root.clone()
            }
        );
        assert!(!request.cancellable);
    }
    assert!(handle.index.is_absolute());
    assert_eq!(handle.directory.parent(), handle.index.parent());
}

/// Existing snapshot or index paths remain byte-for-byte owned by their original creator.
#[test]
fn existing_paths_fail_preparation_without_reuse_or_removal() {
    for index in [false, true] {
        let repository = Repository::new();
        let run = RunId::new("20261006T120000Z", 44).unwrap();
        let paths = SnapshotHandle::paths(&repository.root, &run);
        SystemSnapshotFiles.parent(&repository.root).unwrap();
        let foreign = if index {
            paths.index.clone()
        } else {
            fs::create_dir(&paths.directory).unwrap();
            paths.directory.join("foreign")
        };
        fs::write(&foreign, "belongs to another run\n").unwrap();
        repository.clear_requests();
        assert!(matches!(
            adapter(&repository).create(&run, &repository.head()),
            Err(Error::SnapshotExists { .. })
        ));
        assert_eq!(
            fs::read_to_string(foreign).unwrap(),
            "belongs to another run\n"
        );
        if index {
            assert!(!paths.directory.exists());
        } else {
            assert!(!paths.index.exists());
        }
        assert!(
            !repository
                .process
                .requests
                .lock()
                .unwrap()
                .iter()
                .any(|request| request.args.first().is_some_and(|arg| arg == "worktree"))
        );
    }
}

/// Double force removes locked worktree metadata even after its directory is gone.
#[test]
fn removal_prunes_a_locked_worktree_whose_path_is_already_gone() {
    let repository = Repository::new();
    let initial = checkout(&repository);
    let snapshot = adapter(&repository);
    let handle = snapshot
        .create(
            &RunId::new("20261006T120000Z", 45).unwrap(),
            &repository.head(),
        )
        .unwrap();
    repository.git(&["worktree", "lock", handle.directory.to_str().unwrap()]);
    fs::remove_dir_all(&handle.directory).unwrap();
    snapshot.remove(&handle).unwrap();
    assert!(!handle.index.exists());
    assert_eq!(checkout(&repository), initial);
}
