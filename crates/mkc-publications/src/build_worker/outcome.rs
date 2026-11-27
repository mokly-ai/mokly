//! Exhaustive lifecycle interpretation of runner and upload outcomes.

use chrono::{DateTime, Duration, Utc};
use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_store_interface::build_attempt::BuildFinish;
use mkc_store_interface::build_state::{BuildFailure, BuildState, UploadOutcome};

use super::reason::{self, InfrastructureWarning};

/// Stored result of an ended attempt.
///
/// Only the infrastructure variant yields a retry or exhaustion update, so
/// every infrastructure ending carries its safe warning reason.
pub(super) enum Ending {
    /// A final or published result without an infrastructure warning.
    Settled(BuildFinish),
    /// An infrastructure retry or exhaustion with its safe reason.
    Infrastructure(String),
}

impl Ending {
    /// The update for this attempt and, for infrastructure, its warning facts.
    pub(super) fn resolve(
        self,
        attempt: i32,
        at: DateTime<Utc>,
    ) -> (BuildFinish, Option<InfrastructureWarning>) {
        match self {
            Self::Settled(finish) => (finish, None),
            Self::Infrastructure(reason) => {
                let finish = infrastructure(attempt, at);
                let terminal = finish.state != BuildState::Queued;
                let warning = InfrastructureWarning {
                    attempt,
                    terminal,
                    reason,
                };
                (finish, Some(warning))
            }
        }
    }
}

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

fn infrastructure(attempt: i32, at: DateTime<Utc>) -> BuildFinish {
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
    at: DateTime<Utc>,
) -> Ending {
    let (state, cause, exit) = match outcome {
        BuildOutcome::Completed => return Ending::Infrastructure(reason::completed(upload)),
        BuildOutcome::Infrastructure(error) => {
            return Ending::Infrastructure(reason::runner(error));
        }
        BuildOutcome::StepFailed {
            step: BuildStep::Checkout,
            exit_code,
            ..
        } => return Ending::Infrastructure(reason::checkout(*exit_code)),
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
                Some(grant @ (UploadOutcome::Unavailable | UploadOutcome::Accepted)) => {
                    return Ending::Infrastructure(reason::publish_grant(*exit_code, grant));
                }
                None => match cli_error {
                    Some(MoklyCliCode::UploadFailed) => {
                        return Ending::Infrastructure(reason::publish_upload_failed(*exit_code));
                    }
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
    Ending::Settled(terminal(state, Some(cause), exit, at))
}

#[cfg(test)]
#[path = "../_tests_/build_worker/outcome_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "../_tests_/build_worker/reason_tests.rs"]
mod reason_tests;

#[cfg(test)]
#[path = "_tests_/cli_fixture_tests.rs"]
mod cli_fixture_tests;
