//! Pure process configuration removes secrets for requests and the kill helper.

use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::child_environment::SECRET_VARIABLES;
use crate::remote::contracts::InterruptRequestedMock;
use crate::remote::error::{Error, Operation};
#[cfg(unix)]
use crate::remote::process::kill_command;
use crate::remote::process::{Process, Request, SystemProcess, build_command};

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

#[test]
fn an_interrupted_cancellable_request_returns_a_cancellation_without_a_box_count() {
    let process = SystemProcess {
        interrupt: Arc::new(Unimock::new(
            InterruptRequestedMock.each_call(matching!()).returns(true),
        )),
        clock: Arc::new(Unimock::new(())),
        logs: Arc::new(Unimock::new(())),
    };
    let result = process.execute(&Request {
        program: "node".into(),
        args: vec!["scripts/verification/source-tree.mjs".into()],
        cwd: PathBuf::from("/workspace"),
        operation: Operation::Fingerprint,
        input: None,
        log: Some(PathBuf::from("/workspace/unused.log")),
        cancellable: true,
        blacksmith: false,
    });
    assert!(matches!(result, Err(Error::Cancelled)), "{result:?}");
}
