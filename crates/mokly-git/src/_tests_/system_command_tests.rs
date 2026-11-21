//! Git commands explicitly disable optional index locks.

use std::ffi::OsStr;
use std::path::PathBuf;

use crate::command::{DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};

use super::git_command;

#[test]
fn caller_override_cannot_enable_optional_locks() {
    let request = Request {
        process_mode: Default::default(),
        directory: PathBuf::from("/checkout"),
        args: vec!["status".into()],
        stdin: Vec::new(),
        output_limit: DEFAULT_OUTPUT_LIMIT,
        stderr_limit: DEFAULT_STDERR_LIMIT,
    };
    let command = git_command(&request, &[("GIT_OPTIONAL_LOCKS", "1".into())]);
    assert_eq!(
        command
            .get_envs()
            .find(|(name, _)| *name == "GIT_OPTIONAL_LOCKS")
            .and_then(|(_, value)| value),
        Some(OsStr::new("0"))
    );
}
