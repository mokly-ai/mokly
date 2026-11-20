//! Independent expectations for each row of the runner lifecycle table.

use std::io;

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::error::Error;
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_store_interface::build_state::{BuildFailure, BuildState};

pub(super) struct Case {
    pub(super) outcome: BuildOutcome,
    pub(super) step: Option<BuildStep>,
    pub(super) state: BuildState,
    pub(super) cause: Option<BuildFailure>,
    pub(super) exit: Option<i32>,
}

pub(super) fn cases() -> Vec<Case> {
    let mut cases = vec![
        Case {
            outcome: BuildOutcome::Completed,
            step: Some(BuildStep::Publish),
            state: BuildState::Queued,
            cause: None,
            exit: None,
        },
        Case {
            outcome: BuildOutcome::StepFailed {
                step: BuildStep::Checkout,
                exit_code: Some(1),
                cli_error: None,
            },
            step: Some(BuildStep::Checkout),
            state: BuildState::Queued,
            cause: None,
            exit: None,
        },
        Case {
            outcome: BuildOutcome::StepFailed {
                step: BuildStep::Install,
                exit_code: Some(2),
                cli_error: None,
            },
            step: Some(BuildStep::Install),
            state: BuildState::Failed,
            cause: Some(BuildFailure::Exit),
            exit: Some(2),
        },
        Case {
            outcome: BuildOutcome::StepFailed {
                step: BuildStep::Install,
                exit_code: None,
                cli_error: None,
            },
            step: Some(BuildStep::Install),
            state: BuildState::Failed,
            cause: Some(BuildFailure::Exit),
            exit: None,
        },
        Case {
            outcome: BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: Some(3),
                cli_error: None,
            },
            step: Some(BuildStep::Publish),
            state: BuildState::Failed,
            cause: Some(BuildFailure::Exit),
            exit: Some(3),
        },
        Case {
            outcome: BuildOutcome::UnsupportedLockfile,
            step: Some(BuildStep::Install),
            state: BuildState::Failed,
            cause: Some(BuildFailure::UnsupportedLockfile),
            exit: None,
        },
        Case {
            outcome: BuildOutcome::UnsupportedMoklyVersion,
            step: Some(BuildStep::Publish),
            state: BuildState::Failed,
            cause: Some(BuildFailure::UnsupportedMoklyVersion),
            exit: None,
        },
        Case {
            outcome: BuildOutcome::Infrastructure(
                Error::internal(io::Error::other("fake runner transport failure")).into_internal(),
            ),
            step: None,
            state: BuildState::Queued,
            cause: None,
            exit: None,
        },
    ];
    for (code, cause) in [
        ("git-uncommitted", BuildFailure::UncommittedChanges),
        ("build-stale", BuildFailure::Exit),
    ] {
        for exit_code in [None, Some(9)] {
            cases.push(Case {
                outcome: BuildOutcome::StepFailed {
                    step: BuildStep::Publish,
                    exit_code,
                    cli_error: Some(MoklyCliCode::parse(code)),
                },
                step: Some(BuildStep::Publish),
                state: BuildState::Failed,
                cause: Some(cause),
                exit: exit_code,
            });
        }
    }
    for step in [BuildStep::Checkout, BuildStep::Install, BuildStep::Publish] {
        cases.push(Case {
            outcome: BuildOutcome::OutputOverflow { step },
            step: Some(step),
            state: BuildState::Failed,
            cause: Some(BuildFailure::OutputLimit),
            exit: None,
        });
        for (budget, cause) in [
            (BuildBudget::Deadline, BuildFailure::Deadline),
            (BuildBudget::Idle, BuildFailure::Idle),
        ] {
            cases.push(Case {
                outcome: BuildOutcome::TimedOut { step, budget },
                step: Some(step),
                state: BuildState::TimedOut,
                cause: Some(cause),
                exit: None,
            });
        }
    }
    cases
}
