//! Request-specific Git indexes leave secret removal and default requests intact.

use std::ffi::OsStr;
use std::path::PathBuf;

use crate::child_environment::{GIT_REPOSITORY_VARIABLES, SECRET_VARIABLES};
use crate::remote::error::Operation;
use crate::remote::process::{Request, build_command};

/// Index overrides are scoped to the requesting child and cannot retain secrets.
#[test]
fn git_index_is_scoped_and_secret_removal_always_applies() {
    for index in [None, Some(PathBuf::from("/workspace with space/run.index"))] {
        let request = Request {
            program: "git".into(),
            args: vec!["read-tree".into(), "HEAD".into()],
            cwd: PathBuf::from("/workspace"),
            operation: Operation::Git,
            input: None,
            log: None,
            cancellable: false,
            blacksmith: false,
            git_index: index.clone(),
        };
        let command = build_command(&request);
        let actual = command
            .get_envs()
            .find(|(name, _)| *name == "GIT_INDEX_FILE");
        assert_eq!(
            actual.map(|(_, value)| value),
            Some(index.as_deref().map(|path| path.as_os_str()))
        );
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            [OsStr::new("read-tree"), OsStr::new("HEAD")]
        );
        for secret in SECRET_VARIABLES {
            assert!(
                command
                    .get_envs()
                    .any(|(name, value)| name == *secret && value.is_none())
            );
        }
    }
}

/// Every repository override is removed before a request may select its own index.
#[test]
fn remote_requests_remove_git_repository_variables_before_the_index_override() {
    for index in [None, Some(PathBuf::from("/workspace/run.index"))] {
        let request = Request {
            program: "git".into(),
            args: vec!["read-tree".into(), "HEAD".into()],
            cwd: PathBuf::from("/workspace"),
            operation: Operation::Git,
            input: None,
            log: None,
            cancellable: false,
            blacksmith: false,
            git_index: index.clone(),
        };
        let command = build_command(&request);
        assert_eq!(GIT_REPOSITORY_VARIABLES.len(), 15);
        for name in GIT_REPOSITORY_VARIABLES {
            let actual = command.get_envs().find(|(key, _)| key == name);
            let expected = if *name == "GIT_INDEX_FILE" {
                index.as_deref().map(|path| path.as_os_str())
            } else {
                None
            };
            assert_eq!(actual.map(|(_, value)| value), Some(expected), "{name}");
        }
        for name in SECRET_VARIABLES {
            assert!(
                command
                    .get_envs()
                    .any(|(key, value)| key == *name && value.is_none())
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
}
