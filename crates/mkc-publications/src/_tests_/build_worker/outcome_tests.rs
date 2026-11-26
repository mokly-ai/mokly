//! Exhaustive outcome mapping and retry delay verification.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_store_interface::build_state::{BuildFailure, BuildState, UploadOutcome};

use super::{finish, infrastructure};

#[test]
fn publish_codes_keep_their_causes_and_exit_codes() {
    let at = "2026-10-10T00:00:00Z".parse().unwrap();
    for (code, cause) in [
        ("git-uncommitted", "uncommitted-changes"),
        ("build-stale", "exit"),
    ] {
        for exit in [None, Some(9)] {
            let outcome = BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: exit,
                cli_error: Some(MoklyCliCode::parse(code)),
            };
            let result = finish(&outcome, None, at).resolve(1, at).0;
            assert_eq!(result.state, BuildState::Failed);
            assert_eq!(result.failure_cause.unwrap().as_str(), cause);
            assert_eq!(result.exit_code, exit);
            for (upload, expected) in [
                (UploadOutcome::Rejected, Some(BuildFailure::UploadRejected)),
                (
                    UploadOutcome::PlanRequired,
                    Some(BuildFailure::PlanRequired),
                ),
                (UploadOutcome::Unavailable, None),
                (UploadOutcome::Accepted, None),
            ] {
                assert_eq!(
                    finish(&outcome, Some(upload), at)
                        .resolve(1, at)
                        .0
                        .failure_cause,
                    expected
                );
            }
        }
    }
}

#[test]
fn every_runner_outcome_maps_to_the_lifecycle_table() {
    let at = "2026-10-04T00:00:00Z".parse().unwrap();
    for (outcome, upload, state, cause, exit) in [
        (
            BuildOutcome::Completed,
            None,
            BuildState::Queued,
            None,
            None,
        ),
        (
            BuildOutcome::StepFailed {
                step: BuildStep::Checkout,
                exit_code: Some(1),
                cli_error: None,
            },
            None,
            BuildState::Queued,
            None,
            None,
        ),
        (
            BuildOutcome::StepFailed {
                step: BuildStep::Install,
                exit_code: Some(2),
                cli_error: None,
            },
            None,
            BuildState::Failed,
            Some(BuildFailure::Exit),
            Some(2),
        ),
        (
            BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: Some(3),
                cli_error: None,
            },
            None,
            BuildState::Failed,
            Some(BuildFailure::Exit),
            Some(3),
        ),
        (
            BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: Some(4),
                cli_error: None,
            },
            Some(UploadOutcome::Rejected),
            BuildState::Failed,
            Some(BuildFailure::UploadRejected),
            Some(4),
        ),
        (
            BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: Some(5),
                cli_error: None,
            },
            Some(UploadOutcome::PlanRequired),
            BuildState::Failed,
            Some(BuildFailure::PlanRequired),
            Some(5),
        ),
        (
            BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: Some(6),
                cli_error: None,
            },
            Some(UploadOutcome::Unavailable),
            BuildState::Queued,
            None,
            None,
        ),
        (
            BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: None,
                cli_error: Some(MoklyCliCode::UploadFailed),
            },
            None,
            BuildState::Queued,
            None,
            None,
        ),
        (
            BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: None,
                cli_error: Some(MoklyCliCode::Unrecognized),
            },
            None,
            BuildState::Failed,
            Some(BuildFailure::Exit),
            None,
        ),
        (
            BuildOutcome::UnsupportedLockfile,
            None,
            BuildState::Failed,
            Some(BuildFailure::UnsupportedLockfile),
            None,
        ),
        (
            BuildOutcome::UnsupportedMoklyVersion,
            None,
            BuildState::Failed,
            Some(BuildFailure::UnsupportedMoklyVersion),
            None,
        ),
        (
            BuildOutcome::OutputOverflow {
                step: BuildStep::Publish,
            },
            None,
            BuildState::Failed,
            Some(BuildFailure::OutputLimit),
            None,
        ),
        (
            BuildOutcome::TimedOut {
                step: BuildStep::Install,
                budget: BuildBudget::Deadline,
            },
            None,
            BuildState::TimedOut,
            Some(BuildFailure::Deadline),
            None,
        ),
        (
            BuildOutcome::TimedOut {
                step: BuildStep::Checkout,
                budget: BuildBudget::Idle,
            },
            None,
            BuildState::TimedOut,
            Some(BuildFailure::Idle),
            None,
        ),
    ] {
        let result = finish(&outcome, upload, at).resolve(1, at).0;
        assert_eq!(
            (result.state, result.failure_cause, result.exit_code),
            (state, cause, exit),
            "{outcome:?}"
        );
    }
}

#[test]
fn infrastructure_backoff_is_sixty_through_four_eighty_then_exhausted() {
    let at = "2026-10-04T00:00:00Z".parse().unwrap();
    for (attempt, seconds) in [(1, 60), (2, 120), (3, 240), (4, 480)] {
        let result = infrastructure(attempt, at);
        assert_eq!(result.state, BuildState::Queued);
        assert_eq!((result.next_attempt_at - at).num_seconds(), seconds);
        assert!(result.failure_cause.is_none());
    }
    let result = infrastructure(5, at);
    assert_eq!(result.state, BuildState::Failed);
    assert_eq!(result.failure_cause, Some(BuildFailure::Infrastructure));
}
