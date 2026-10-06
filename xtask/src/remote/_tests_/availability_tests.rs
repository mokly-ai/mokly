//! First-failure availability checks with no ambient state or real commands.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use crate::remote::runner::DefaultRemoteRunner;

fn command_failure() -> Error {
    Error::Command {
        operation: Operation::Blacksmith,
        code: Some(1),
    }
}

fn fixture(stage: usize, key: bool) -> (DefaultRemoteRunner, Arc<Mutex<Vec<String>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let environment = Arc::new(if stage <= 4 {
        Unimock::new(
            EnvironmentGetMock
                .next_call(matching!("GITHUB_ACTIONS"))
                .returns(if stage == 0 {
                    Some("true".into())
                } else {
                    None
                }),
        )
    } else {
        Unimock::new((
            EnvironmentGetMock
                .next_call(matching!("GITHUB_ACTIONS"))
                .returns(None),
            EnvironmentGetMock
                .next_call(matching!("BLACKSMITH_ORG_TOKEN"))
                .returns(key.then(|| "test-key".into())),
        ))
    });
    let lookup_events = events.clone();
    let programs = Arc::new(if stage == 0 {
        Unimock::new(())
    } else {
        Unimock::new(
            ProgramsFindMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, name| {
                    lookup_events.lock().unwrap().push(name.into());
                    Ok(!matches!(
                        (stage, name),
                        (1, "blacksmith") | (2, "rsync") | (3, "ssh")
                    ))
                })),
        )
    });
    let version_events = events.clone();
    let version = BlacksmithVersionMock
        .next_call(matching!())
        .answers_arc(Arc::new(move |_| {
            version_events.lock().unwrap().push("version".into());
            if stage == 4 {
                Err(command_failure())
            } else {
                Ok("test-cli".into())
            }
        }));
    let login_events = events.clone();
    let login = BlacksmithLoginMock
        .next_call(matching!("test-key"))
        .answers_arc(Arc::new(move |_, _| {
            login_events.lock().unwrap().push("login".into());
            if stage == 5 {
                Err(command_failure())
            } else {
                Ok(())
            }
        }));
    let list_events = events.clone();
    let list = BlacksmithListMock
        .next_call(matching!())
        .answers_arc(Arc::new(move |_| {
            list_events.lock().unwrap().push("list".into());
            if stage == 6 {
                Err(command_failure())
            } else {
                Ok(())
            }
        }));
    let blacksmith = Arc::new(if stage < 4 {
        Unimock::new(())
    } else if stage == 4 {
        Unimock::new(version)
    } else if stage == 5 {
        Unimock::new((version, login))
    } else if key {
        Unimock::new((version, login, list))
    } else {
        Unimock::new((version, list))
    });
    let publish_events = events.clone();
    let git = Arc::new(if stage < 7 {
        Unimock::new(())
    } else {
        Unimock::new(
            GitPublishedMock
                .next_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    publish_events.lock().unwrap().push("published".into());
                    Ok(stage != 7)
                })),
        )
    });
    let reporter = Arc::new(if stage < 5 {
        Unimock::new(())
    } else {
        Unimock::new(
            ReporterExecutorMock
                .next_call(matching!("test-cli"))
                .returns(()),
        )
    });
    let interrupt = Arc::new(if stage < 8 {
        Unimock::new(())
    } else {
        Unimock::new(
            InterruptRequestedMock
                .next_call(matching!())
                .returns(stage == 8),
        )
    });
    let unused = Arc::new(Unimock::new(()));
    (
        DefaultRemoteRunner {
            dependencies: Dependencies {
                environment,
                programs,
                git,
                blacksmith,
                reporter,
                interrupt,
                clock: unused.clone(),
                github: unused.clone(),
                fingerprint: unused.clone(),
                aggregate: unused.clone(),
                logs: unused,
                workspace: PathBuf::from("/workspace"),
            },
        },
        events,
    )
}

#[test]
fn each_remote_condition_fails_before_the_next_condition() {
    let all = [
        "blacksmith",
        "rsync",
        "ssh",
        "version",
        "login",
        "list",
        "published",
    ];
    for stage in 0..=9 {
        let (runner, events) = fixture(stage, true);
        let result = runner.require_remote();
        assert_eq!(result.is_ok(), stage == 9, "stage={stage}");
        match (stage, result) {
            (0, Err(Error::GithubActions))
            | (7, Err(Error::UnpublishedHead))
            | (8, Err(Error::Interrupted))
            | (9, Ok(())) => {}
            (1..=3, Err(Error::MissingProgram { program, hint })) => {
                assert_eq!(program, all[stage - 1]);
                assert!(hint.contains(if stage == 1 {
                    "https://get.blacksmith.sh"
                } else {
                    "package manager"
                }));
            }
            (4..=6, Err(Error::Command { .. })) => {}
            (_, result) => panic!("stage={stage}: {result:?}"),
        }
        assert_eq!(*events.lock().unwrap(), all[..stage.min(7)]);
    }
}

#[test]
fn explicit_remote_uses_current_login_when_the_key_is_missing() {
    let (runner, events) = fixture(9, false);
    runner.require_remote().unwrap();
    assert_eq!(
        *events.lock().unwrap(),
        ["blacksmith", "rsync", "ssh", "version", "list", "published"]
    );
}
