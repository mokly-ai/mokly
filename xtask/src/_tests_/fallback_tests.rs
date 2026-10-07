//! Typed preparation fallback and terminal failure behavior.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::application::{Application, Xtask};
use crate::check::runner::CheckRunnerRunMock;
use crate::cli::Command;
use crate::error;
use crate::executor::{Decision, Executor};
use crate::remote::availability::SelectorSelectMock;
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use crate::remote::runner::{Failure, RemoteRunnerRunMock};

#[test]
fn fallback_requires_auto_and_an_unavailable_preparation() {
    for (mode, scenario, local) in [
        (Executor::Auto, 0, true),
        (Executor::Remote, 0, false),
        (Executor::Auto, 1, false),
        (Executor::Auto, 2, false),
        (Executor::Auto, 3, false),
    ] {
        let unused = Arc::new(Unimock::new(()));
        let checks = Arc::new(if local {
            Unimock::new(CheckRunnerRunMock.next_call(matching!(_)).returns(Ok(())))
        } else {
            Unimock::new(())
        });
        let selector = Arc::new(Unimock::new(
            SelectorSelectMock
                .next_call(matching!(_))
                .answers(&|_, _| Ok(Decision::Remote)),
        ));
        let runner = Arc::new(Unimock::new(
            RemoteRunnerRunMock
                .next_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    Err(match scenario {
                        1 => Failure::Failed(Error::Command {
                            operation: Operation::Blacksmith,
                            code: Some(1),
                        }),
                        2 => Failure::Unavailable(Error::Interrupted),
                        _ => Failure::Unavailable(Error::WarmupIds { count: 0 }),
                    })
                })),
        ));
        let interrupt = Arc::new(if mode == Executor::Auto && scenario != 1 {
            Unimock::new((
                InterruptArmMock.next_call(matching!()).answers(&|_| Ok(())),
                InterruptReleaseMock.next_call(matching!()).returns(()),
                InterruptRequestedMock
                    .each_call(matching!())
                    .returns(scenario == 3),
            ))
        } else {
            Unimock::new(InterruptArmMock.next_call(matching!()).answers(&|_| Ok(())))
        });
        let app = Application {
            selector,
            remote_runner: runner,
            check_runner: checks,
            environment: Arc::new(Unimock::new(
                EnvironmentGetMock
                    .next_call(matching!("MOKLY_CHECK_EXECUTOR"))
                    .returns(None),
            )),
            reporter: Arc::new(Unimock::new(
                ReporterExecutorMock.each_call(matching!(_)).returns(()),
            )),
            interrupt,
            rust_file_length_auditor: unused,
            workspace: PathBuf::from("/workspace"),
        };
        let result = app.run(Command::Check {
            suite: None,
            shard: None,
            dependency_audit: None,
            executor: Some(mode),
        });
        assert_eq!(result.is_ok(), local, "{mode:?} scenario={scenario}");
    }
}

#[test]
fn executor_emits_one_result_and_never_calls_the_runner() {
    let unused = Arc::new(Unimock::new(()));
    let app = Application {
        selector: Arc::new(Unimock::new(
            SelectorSelectMock
                .next_call(matching!(Executor::Auto))
                .answers(&|_, _| Ok(Decision::Remote)),
        )),
        remote_runner: unused.clone(),
        check_runner: unused.clone(),
        interrupt: unused.clone(),
        rust_file_length_auditor: unused,
        environment: Arc::new(Unimock::new(
            EnvironmentGetMock
                .next_call(matching!("MOKLY_CHECK_EXECUTOR"))
                .returns(None),
        )),
        reporter: Arc::new(Unimock::new(
            ReporterDecisionMock
                .next_call(matching!(Decision::Remote))
                .returns(()),
        )),
        workspace: PathBuf::from("/workspace"),
    };
    app.run(Command::Executor { executor: None }).unwrap();
}

#[test]
fn fallback_releases_before_local_run_and_checks_the_flag_after_release() {
    for interrupted_after_release in [false, true] {
        let events = Arc::new(Mutex::new(Vec::new()));
        let released = Arc::new(AtomicBool::new(false));
        let release_events = events.clone();
        let request_events = events.clone();
        let run_events = events.clone();
        let release_state = released.clone();
        let request_state = released.clone();
        let unused = Arc::new(Unimock::new(()));
        let app = Application {
            selector: Arc::new(Unimock::new(
                SelectorSelectMock
                    .next_call(matching!(Executor::Auto))
                    .answers(&|_, _| Ok(Decision::Remote)),
            )),
            remote_runner: Arc::new(Unimock::new(
                RemoteRunnerRunMock
                    .next_call(matching!())
                    .answers(&|_| Err(Failure::Unavailable(Error::WarmupIds { count: 0 }))),
            )),
            check_runner: Arc::new(if interrupted_after_release {
                Unimock::new(())
            } else {
                Unimock::new(
                    CheckRunnerRunMock
                        .next_call(matching!(_))
                        .answers_arc(Arc::new(move |_, _| {
                            assert!(released.load(Ordering::SeqCst));
                            run_events.lock().unwrap().push("local");
                            Ok(())
                        })),
                )
            }),
            interrupt: Arc::new(Unimock::new((
                InterruptArmMock.next_call(matching!()).answers(&|_| Ok(())),
                InterruptReleaseMock
                    .next_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        release_state.store(true, Ordering::SeqCst);
                        release_events.lock().unwrap().push("release");
                    })),
                InterruptRequestedMock
                    .each_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        let after_release = request_state.load(Ordering::SeqCst);
                        request_events.lock().unwrap().push(if after_release {
                            "flag-after"
                        } else {
                            "flag-before"
                        });
                        after_release && interrupted_after_release
                    })),
            ))),
            environment: Arc::new(Unimock::new(
                EnvironmentGetMock
                    .next_call(matching!("MOKLY_CHECK_EXECUTOR"))
                    .returns(None),
            )),
            reporter: Arc::new(Unimock::new(
                ReporterExecutorMock.each_call(matching!(_)).returns(()),
            )),
            rust_file_length_auditor: unused,
            workspace: PathBuf::from("/workspace"),
        };
        let result = app.run(Command::Check {
            suite: None,
            shard: None,
            dependency_audit: None,
            executor: None,
        });
        if interrupted_after_release {
            assert!(matches!(
                result,
                Err(error::Error::Remote {
                    source: Error::Interrupted
                })
            ));
        } else {
            result.unwrap();
        }
        let events = events.lock().unwrap();
        assert_eq!(
            *events,
            if interrupted_after_release {
                vec!["release", "flag-after"]
            } else {
                vec!["release", "flag-after", "local"]
            }
        );
    }
}
