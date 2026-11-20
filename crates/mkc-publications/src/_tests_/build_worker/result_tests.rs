//! Real worker finalization through mocked runner, grant and query boundaries.

use std::sync::{Arc, Mutex};

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_build_interface::runner::BuildRunnerMock;
use mkc_domain::values::Plan;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_grant::{BuildUploadGrant, BuildUploadGrantsMock};
use mkc_store_interface::build_state::{BuildFailure, BuildState, UploadOutcome};
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::BuildClaim;
use crate::tests::build_fixtures::*;

use super::support::{clock, start_queries, worker};

#[tokio::test]
async fn worker_finalizes_runner_and_recorded_upload_outcomes_with_its_lease() {
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
        let grant = upload.map(|outcome| BuildUploadGrant {
            id: LEASE,
            build_id: BUILD,
            attempt: 1,
            token_digest: [0; 32],
            expires_at: now(),
            consumed_at: None,
            outcome: Some(outcome),
            created_at: now(),
        });
        let queries = Unimock::new((
            eligibility(
                Some(project()),
                Some(repository()),
                Some(installation()),
                Plan::Free,
            ),
            start_queries(),
            BuildsMock::build
                .some_call(matching!(_, _))
                .returns(Ok(Some(build(BuildState::Running)))),
            BuildUploadGrantsMock::build_attempt_grant
                .some_call(matching!(_, 1))
                .returns(Ok(grant)),
            super::support::expiration(),
            BuildsMock::finish_build
                .some_call(matching!(_, Some(_), _))
                .answers_arc(Arc::new(move |_, id, lease, finish| {
                    assert_eq!((id, lease), (BUILD, Some(LEASE)));
                    assert_eq!(
                        (finish.state, finish.failure_cause, finish.exit_code),
                        (state, cause, exit)
                    );
                    if state == BuildState::Queued {
                        assert_eq!((finish.next_attempt_at - now()).num_seconds(), 60);
                    }
                    Ok(true)
                })),
        ));
        let outcome = Mutex::new(Some(outcome));
        let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers_arc(
            Arc::new(move |_, _, _| {
                let outcome = outcome.lock().unwrap().take().unwrap();
                Box::pin(async move { outcome })
            }),
        ));
        let credentials = Unimock::new(
            TokensMock::repository_read
                .some_call(matching!(1, 100))
                .returns(Ok(Secret::new("scoped".into()))),
        );
        let worker = worker(queries, Arc::new(credentials), Arc::new(runner), clock(), 4);
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("attempt required");
        };
        worker.execute(*attempt).await.unwrap();
    }
}
