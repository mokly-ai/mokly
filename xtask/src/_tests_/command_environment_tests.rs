//! Local subprocess configuration removes secrets without reading the environment.

use std::ffi::OsStr;
use std::path::Path;

use crate::child_environment::{GIT_REPOSITORY_VARIABLES, SECRET_VARIABLES};
use crate::command::{CommandSpec, build_command};

#[test]
fn local_command_removes_the_org_key_and_keeps_its_arguments_and_directory() {
    let command = build_command(
        &CommandSpec::new("npm")
            .args(["run", "lint"])
            .in_directory("/workspace"),
    );
    assert_eq!(command.get_program(), OsStr::new("npm"));
    assert_eq!(
        command.get_args().collect::<Vec<_>>(),
        [OsStr::new("run"), OsStr::new("lint")]
    );
    assert_eq!(command.get_current_dir(), Some(Path::new("/workspace")));
    for secret in SECRET_VARIABLES {
        assert!(
            command
                .get_envs()
                .any(|(name, value)| name == *secret && value.is_none())
        );
    }
}

/// Local children use their directory and keep inherited network and prompt settings.
#[test]
fn local_commands_remove_git_repository_variables() {
    let command = build_command(&CommandSpec::new("git").args(["status"]));
    assert_eq!(GIT_REPOSITORY_VARIABLES.len(), 15);
    for name in GIT_REPOSITORY_VARIABLES.iter().chain(SECRET_VARIABLES) {
        assert!(
            command
                .get_envs()
                .any(|(key, value)| key == *name && value.is_none()),
            "{name} must be removed"
        );
    }
    for name in [
        "GIT_ASKPASS",
        "GIT_SSH_COMMAND",
        "GIT_CONFIG_GLOBAL",
        "GIT_CONFIG_NOSYSTEM",
    ] {
        assert!(!command.get_envs().any(|(key, _)| key == name));
    }
}
