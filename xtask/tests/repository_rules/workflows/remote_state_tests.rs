//! No workflow or composite-action step deletes shared remote Git state.

use crate::support::{automation_files, read_yaml, run_scripts};

use super::remote_state_commands::remote_state_deleting_commands;

#[test]
fn remote_state_guard_recognizes_every_prohibited_command_form() {
    for command in [
        "git remote remove origin",
        "git remote rm upstream",
        "git -C repository remote remove origin",
        "git -c protocol.version=2 remote rm origin",
        "git update-ref -d refs/heads/example",
        "git update-ref --delete refs/heads/example",
        "git update-ref --stdin",
        "git update-ref refs/remotes/origin/main HEAD",
        "git branch -dr origin/example",
        "git branch -rd origin/example",
        "git branch -Dr origin/example",
        "git branch -rD origin/example",
        "git branch -d -r origin/example",
        "git branch -D -r origin/example",
        "git branch --delete --remotes origin/example",
        "git branch --delete -r origin/example",
        "git branch --unset-upstream",
        "git config --unset remote.origin.url",
        "git config --unset-all branch.main.merge",
        "git config --remove-section remote.origin",
        "node scripts/verification/remove-remote-state.mjs",
    ] {
        assert_eq!(
            remote_state_deleting_commands(&[command]),
            [command],
            "{command}"
        );
    }
}

#[test]
fn remote_state_guard_handles_blocks_continuations_and_old_cleanup_steps() {
    let old_inline =
        "git for-each-ref --format='delete %(refname)' refs/remotes/ |\n  git update-ref --stdin";
    let continued = "git -C repository \\\n  -c protocol.version=2 \\\n  update-ref \\\n  --stdin";
    let old_script = "node scripts/verification/remove-remote-state.mjs";
    let chained = "printf 'ready' && git remote remove origin";

    assert_eq!(remote_state_deleting_commands(&[old_inline]).len(), 1);
    assert_eq!(remote_state_deleting_commands(&[continued]).len(), 1);
    assert_eq!(remote_state_deleting_commands(&[old_script]), [old_script]);
    assert_eq!(
        remote_state_deleting_commands(&[chained]),
        ["git remote remove origin"]
    );
}

#[test]
fn remote_state_guard_permits_read_only_and_unrelated_commands() {
    let none: [&str; 0] = [];
    assert_eq!(
        remote_state_deleting_commands(&[
            "git fetch origin",
            "git fetch --prune",
            "git remote -v",
            "git update-ref refs/heads/x HEAD",
            "git branch -d feature",
            "git config --get remote.origin.url",
            "git log origin/main",
            r#"echo "remote work remains""#,
            r#"echo "git remote remove origin""#,
        ]),
        none
    );
}

#[test]
fn workflows_and_composite_actions_never_delete_remote_git_state() {
    for file in automation_files() {
        let document = read_yaml(&file);
        let deleting = remote_state_deleting_commands(&run_scripts(&document));
        assert!(
            deleting.is_empty(),
            "{file} deletes remote Git state:\n{}",
            deleting.join("\n")
        );
    }
}
