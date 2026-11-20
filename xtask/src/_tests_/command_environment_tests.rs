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
    assert_eq!(
        command.get_program(),
        OsStr::new(if cfg!(windows) { "npm.cmd" } else { "npm" })
    );
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

#[test]
fn database_suite_plan_preserves_strict_commands_and_child_environment() {
    let spec = CommandSpec::isolated_database(
        "cloud-app",
        vec![
            CommandSpec::new("npm")
                .args(["run", "test:browser", "--workspace", "@mokly-cloud/app"])
                .with_environment("MKC_APP_SHARD", Some("2/4"))
                .with_environment("REMOVE_ME", None)
                .reject_skips(),
        ],
    );
    let command = build_command(&spec);
    let args: Vec<_> = command.get_args().collect();
    assert_eq!(args[0], "xtask/scripts/isolated-postgres.mjs");
    assert_eq!(args[1], "cloud-app");
    let plan: serde_json::Value = serde_json::from_str(args[2].to_str().unwrap()).unwrap();
    assert_eq!(plan[0]["program"], "node");
    assert_eq!(plan[0]["args"][0], "xtask/scripts/strict-command.mjs");
    assert_eq!(plan[0]["args"][2], "run");
    assert_eq!(
        plan[0]["environment"][0],
        serde_json::json!(["MKC_APP_SHARD", "2/4"])
    );
    assert_eq!(
        plan[0]["environment"][1],
        serde_json::json!(["REMOVE_ME", null])
    );
}
