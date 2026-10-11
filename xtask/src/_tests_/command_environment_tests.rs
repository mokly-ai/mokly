//! Local subprocess configuration removes secrets without reading the environment.

use std::ffi::OsStr;
use std::path::Path;

use crate::child_environment::SECRET_VARIABLES;
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
