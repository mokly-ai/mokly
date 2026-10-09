//! Pure process configuration removes secrets for requests and the kill helper.

use std::ffi::OsStr;
use std::path::{Path, PathBuf};

use crate::child_environment::{GIT_REPOSITORY_VARIABLES, SECRET_VARIABLES};
use crate::remote::error::Operation;
#[cfg(unix)]
use crate::remote::process::kill_command;
use crate::remote::process::{Request, build_command};

#[test]
fn every_remote_request_removes_the_org_key_and_keeps_cli_configuration() {
    for blacksmith in [false, true] {
        let command = build_command(&Request {
            program: if blacksmith { "blacksmith" } else { "gh" }.into(),
            args: vec!["--version".into()],
            cwd: PathBuf::from("/workspace"),
            operation: Operation::Blacksmith,
            input: None,
            log: None,
            cancellable: true,
            git_index: None,
            blacksmith,
        });
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            [OsStr::new("--version")]
        );
        assert_eq!(command.get_current_dir(), Some(Path::new("/workspace")));
        for secret in SECRET_VARIABLES {
            assert!(
                command
                    .get_envs()
                    .any(|(name, value)| name == *secret && value.is_none())
            );
        }
        let auto_update = command
            .get_envs()
            .find(|(name, _)| *name == "BLACKSMITH_DISABLE_AUTO_UPDATE");
        assert_eq!(
            auto_update.map(|(_, value)| value),
            blacksmith.then_some(Some(OsStr::new("1")))
        );
    }
}

#[cfg(unix)]
#[test]
fn process_group_kill_removes_the_org_key_without_spawning_a_helper() {
    let command = kill_command(123);
    assert_eq!(command.get_program(), OsStr::new("kill"));
    assert_eq!(
        command.get_args().collect::<Vec<_>>(),
        [OsStr::new("-KILL"), OsStr::new("--"), OsStr::new("-123")]
    );
    for secret in SECRET_VARIABLES {
        assert!(
            command
                .get_envs()
                .any(|(name, value)| name == *secret && value.is_none())
        );
    }
}

/// Cleanup helpers cannot pass repository selection or config to their descendants.
#[cfg(unix)]
#[test]
fn process_group_kill_removes_git_repository_variables() {
    let command = kill_command(123);
    for name in GIT_REPOSITORY_VARIABLES.iter().chain(SECRET_VARIABLES) {
        assert!(
            command
                .get_envs()
                .any(|(key, value)| key == *name && value.is_none()),
            "{name} must be removed"
        );
    }
    for name in ["GIT_ASKPASS", "GIT_SSH_COMMAND"] {
        assert!(!command.get_envs().any(|(key, _)| key == name));
    }
}
