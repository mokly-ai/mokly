//! Request-specific Git indexes leave secret removal and default requests intact.

use std::ffi::OsStr;
use std::path::PathBuf;

use crate::child_environment::SECRET_VARIABLES;
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
