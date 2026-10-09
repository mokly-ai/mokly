//! Re-exec snapshot regressions for Git-started linked-worktree commands.

use self::environment_support::regression;

#[path = "environment_support.rs"]
mod environment_support;

/// A hook's absolute Git directory cannot select the checkout index in a snapshot.
#[test]
fn snapshot_preserves_linked_checkout_with_inherited_git_dir() {
    regression(
        "snapshot_preserves_linked_checkout_with_inherited_git_dir",
        false,
    );
}

/// An explicit work-tree override cannot redirect snapshot file and index updates.
#[test]
fn snapshot_preserves_linked_checkout_with_inherited_git_dir_and_work_tree() {
    regression(
        "snapshot_preserves_linked_checkout_with_inherited_git_dir_and_work_tree",
        true,
    );
}
