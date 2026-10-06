//! Executor selection and signal failures over injected boundaries.

use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::application::{Application, Xtask};
use crate::check::{CheckRequest, CheckRunnerRunMock, VerificationSuite};
use crate::cli::Command;
use crate::error::Error;
use crate::executor::Executor;
use crate::remote::contracts::{EnvironmentGetMock, InterruptArmMock, ReporterExecutorMock};
use crate::remote::error;
use crate::remote::runner::RemoteRunnerRunMock;

fn application(
    environment: Option<&str>,
    suite: Option<VerificationSuite>,
    remote: bool,
) -> Application {
    let unused = Arc::new(Unimock::new(()));
    let check_runner = Arc::new(if remote {
        Unimock::new(())
    } else {
        Unimock::new(
            CheckRunnerRunMock
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| {
                    assert_eq!(request, CheckRequest::new(suite, None).unwrap());
                    Ok(())
                })),
        )
    });
    let remote_runner = Arc::new(if remote {
        Unimock::new(
            RemoteRunnerRunMock
                .next_call(matching!())
                .answers(&|_| Ok(())),
        )
    } else {
        Unimock::new(())
    });
    let interrupt = Arc::new(if remote {
        Unimock::new(InterruptArmMock.next_call(matching!()).answers(&|_| Ok(())))
    } else {
        Unimock::new(())
    });
    Application {
        check_runner,
        remote_runner,
        interrupt,
        environment: Arc::new(Unimock::new(
            EnvironmentGetMock
                .next_call(matching!("MOKLY_CHECK_EXECUTOR"))
                .returns(environment.map(str::to_owned)),
        )),
        reporter: Arc::new(Unimock::new(
            ReporterExecutorMock
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    assert!(message.starts_with(if remote { "remote:" } else { "local:" }));
                })),
        )),
        rust_file_length_auditor: unused,
        workspace: PathBuf::from("/workspace"),
    }
}

#[test]
fn auto_and_selected_suites_keep_local_behavior() {
    for (mode, suite) in [
        (None, None),
        (Some("auto"), None),
        (Some("local"), None),
        (None, Some(VerificationSuite::Package)),
    ] {
        application(mode, suite, false)
            .run(Command::Check {
                suite,
                shard: None,
                executor: None,
            })
            .unwrap();
    }
}

#[test]
fn flags_override_environment_and_inherited_remote_runs_the_runner() {
    for (mode, flag, remote) in [
        (Some("invalid"), Some(Executor::Local), false),
        (Some("remote"), Some(Executor::Auto), false),
        (Some("local"), Some(Executor::Remote), true),
        (Some("remote"), None, true),
    ] {
        application(mode, None, remote)
            .run(Command::Check {
                suite: None,
                shard: None,
                executor: flag,
            })
            .unwrap();
    }
}

fn rejecting_application(environment: Arc<Unimock>, interrupt: Arc<Unimock>) -> Application {
    let unused = Arc::new(Unimock::new(()));
    Application {
        check_runner: unused.clone(),
        remote_runner: unused.clone(),
        rust_file_length_auditor: unused.clone(),
        reporter: unused,
        environment,
        interrupt,
        workspace: PathBuf::from("/workspace"),
    }
}

#[test]
fn remote_with_suite_and_invalid_environment_fail_before_any_work() {
    for (flag, variable, expected_suite) in [
        (Some(Executor::Remote), None, true),
        (None, Some("remote"), true),
        (None, Some("invalid"), false),
    ] {
        let environment = Arc::new(if flag.is_some() {
            Unimock::new(())
        } else {
            Unimock::new(
                EnvironmentGetMock
                    .next_call(matching!("MOKLY_CHECK_EXECUTOR"))
                    .returns(variable.map(str::to_owned)),
            )
        });
        let app = rejecting_application(environment, Arc::new(Unimock::new(())));
        let result = app.run(Command::Check {
            suite: Some(VerificationSuite::Package),
            shard: None,
            executor: flag,
        });
        assert!(
            matches!(result,
                Err(Error::Remote { source: error::Error::SelectedSuite }) if expected_suite
            ) || matches!(result,
                Err(Error::Remote { source: error::Error::InvalidExecutor { .. } }) if !expected_suite
            )
        );
    }
}

#[test]
fn signal_registration_failure_cannot_start_remote_work() {
    let environment = Arc::new(Unimock::new(
        EnvironmentGetMock
            .next_call(matching!("MOKLY_CHECK_EXECUTOR"))
            .returns(Some("remote".into())),
    ));
    let interrupt = Arc::new(Unimock::new(
        InterruptArmMock.next_call(matching!()).answers(&|_| {
            Err(error::Error::Signal {
                source: ctrlc::Error::MultipleHandlers,
            })
        }),
    ));
    assert!(
        rejecting_application(environment, interrupt)
            .run(Command::Check {
                suite: None,
                shard: None,
                executor: None
            })
            .is_err()
    );
}
