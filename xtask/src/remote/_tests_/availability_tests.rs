//! First-failure availability checks with no ambient state or real commands.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::executor::{Decision, Executor};
use crate::remote::availability::{DefaultSelector, Selector};
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};

fn command_failure() -> Error {
    Error::Command {
        operation: Operation::Blacksmith,
        code: Some(1),
    }
}

fn fixture(stage: usize, key: bool, mode: Executor) -> (DefaultSelector, Arc<Mutex<Vec<String>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let early_local = stage == 0 || (mode == Executor::Auto && !key);
    let environment = Arc::new(if stage == 0 || (stage <= 4 && mode == Executor::Remote) {
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
    let programs = Arc::new(if early_local {
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
    let blacksmith = Arc::new(if stage < 4 || early_local {
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
    let git = Arc::new(if stage < 7 || early_local {
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
    let reporter = Arc::new(if mode == Executor::Auto && stage == 0 {
        Unimock::new(())
    } else if mode == Executor::Auto && (stage < 9 || !key) {
        Unimock::new(ReporterExecutorMock.each_call(matching!(_)).returns(()))
    } else if stage < 5 {
        Unimock::new(())
    } else {
        Unimock::new(
            ReporterExecutorMock
                .next_call(matching!("test-cli"))
                .returns(()),
        )
    });
    let interrupt = Arc::new(if stage < 8 || early_local {
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
        DefaultSelector {
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
        let (runner, events) = fixture(stage, true, Executor::Remote);
        let result = runner.select(Executor::Remote);
        assert_eq!(result.is_ok(), stage == 9, "stage={stage}");
        match (stage, result) {
            (0, Err(Error::GithubActions))
            | (7, Err(Error::UnpublishedHead))
            | (8, Err(Error::Interrupted { cleanup: 0 }))
            | (9, Ok(Decision::Remote)) => {}
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
    let (runner, events) = fixture(9, false, Executor::Remote);
    assert_eq!(runner.select(Executor::Remote).unwrap(), Decision::Remote);
    assert_eq!(
        *events.lock().unwrap(),
        ["blacksmith", "rsync", "ssh", "version", "list", "published"]
    );
}

#[test]
fn automatic_selection_uses_every_table_row_and_never_hides_interrupts() {
    for stage in 0..=9 {
        let (selector, _) = fixture(stage, true, Executor::Auto);
        let result = selector.select(Executor::Auto);
        if stage == 8 {
            assert!(matches!(result, Err(Error::Interrupted { cleanup: 0 })));
        } else if stage == 9 {
            assert_eq!(result.unwrap(), Decision::Remote);
        } else {
            assert!(matches!(result, Ok(Decision::Local(_))));
        }
    }
}

#[test]
fn missing_key_selects_local_before_any_program_lookup() {
    let (selector, events) = fixture(9, false, Executor::Auto);
    assert!(matches!(
        selector.select(Executor::Auto).unwrap(),
        Decision::Local(_)
    ));
    assert!(events.lock().unwrap().is_empty());
}
