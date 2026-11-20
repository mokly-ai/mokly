//! Exhaustive lifecycle interpretation of runner and upload outcomes.

use chrono::{DateTime, Duration, Utc};
use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_store_interface::build_attempt::BuildFinish;
use mkc_store_interface::build_state::{BuildFailure, BuildState, UploadOutcome};

pub(super) fn terminal(
    state: BuildState,
    cause: Option<BuildFailure>,
    exit: Option<i32>,
    at: DateTime<Utc>,
) -> BuildFinish {
    BuildFinish {
        state,
        failure_cause: cause,
        exit_code: exit,
        at,
        next_attempt_at: at,
    }
}

pub(super) fn infrastructure(attempt: i32, at: DateTime<Utc>) -> BuildFinish {
    if attempt >= 5 {
        terminal(
            BuildState::Failed,
            Some(BuildFailure::Infrastructure),
            None,
            at,
        )
    } else {
        BuildFinish {
            state: BuildState::Queued,
            failure_cause: None,
            exit_code: None,
            at,
            next_attempt_at: at + Duration::seconds(60_i64 << (attempt - 1).clamp(0, 3)),
        }
    }
}

pub(super) fn finish(
    outcome: &BuildOutcome,
    upload: Option<UploadOutcome>,
    attempt: i32,
    at: DateTime<Utc>,
) -> BuildFinish {
    let (state, cause, exit) = match outcome {
        BuildOutcome::Completed | BuildOutcome::Infrastructure(_) => {
            return infrastructure(attempt, at);
        }
        BuildOutcome::StepFailed {
            step: BuildStep::Checkout,
            ..
        } => return infrastructure(attempt, at),
        BuildOutcome::StepFailed {
            step: BuildStep::Install,
            exit_code,
            ..
        } => (BuildState::Failed, BuildFailure::Exit, *exit_code),
        BuildOutcome::StepFailed {
            step: BuildStep::Publish,
            exit_code,
            cli_error,
        } => {
            let cause = match upload {
                Some(UploadOutcome::Rejected) => BuildFailure::UploadRejected,
                Some(UploadOutcome::PlanRequired) => BuildFailure::PlanRequired,
                Some(UploadOutcome::Unavailable | UploadOutcome::Accepted) => {
                    return infrastructure(attempt, at);
                }
                None => match cli_error {
                    Some(MoklyCliCode::UploadFailed) => return infrastructure(attempt, at),
                    Some(MoklyCliCode::GitUncommitted) => BuildFailure::UncommittedChanges,
                    Some(MoklyCliCode::Unrecognized) | None => BuildFailure::Exit,
                },
            };
            (BuildState::Failed, cause, *exit_code)
        }
        BuildOutcome::UnsupportedLockfile => {
            (BuildState::Failed, BuildFailure::UnsupportedLockfile, None)
        }
        BuildOutcome::UnsupportedMoklyVersion => (
            BuildState::Failed,
            BuildFailure::UnsupportedMoklyVersion,
            None,
        ),
        BuildOutcome::OutputOverflow { .. } => {
            (BuildState::Failed, BuildFailure::OutputLimit, None)
        }
        BuildOutcome::TimedOut { budget, .. } => (
            BuildState::TimedOut,
            match budget {
                BuildBudget::Deadline => BuildFailure::Deadline,
                BuildBudget::Idle => BuildFailure::Idle,
            },
            None,
        ),
    };
    terminal(state, Some(cause), exit, at)
}

#[cfg(test)]
#[path = "../_tests_/build_worker/outcome_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "_tests_/cli_fixture_tests.rs"]
mod cli_fixture_tests;
