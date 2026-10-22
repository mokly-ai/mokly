//! Git process environment sanitization and explicitly owned overrides.

use crate::command::Request;
use std::ffi::OsString;
use std::process::{Command, Stdio};

pub(crate) fn git_command(request: &Request, environment: &[(&str, OsString)]) -> Command {
    let mut command = Command::new("git");
    command
        .args(&request.args)
        .current_dir(&request.directory)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for variable in [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_COMMON_DIR",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_NAMESPACE",
        "GIT_PREFIX",
        "GIT_SHALLOW_FILE",
        "GIT_GRAFT_FILE",
        "GIT_REPLACE_REF_BASE",
        "GIT_NO_REPLACE_OBJECTS",
        "GIT_IMPLICIT_WORK_TREE",
    ] {
        command.env_remove(variable);
    }
    command.env("GIT_NO_LAZY_FETCH", "1");
    for (name, value) in environment {
        command.env(name, value);
    }
    command
}
