//! Failed publish steps retain CLI codes for refusals and retry unavailable uploads.

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::build_state::{BuildFailure, BuildState, UploadOutcome};

use super::support::{assert_finished, assert_started, controlled_fixture, runner, schedule};

#[tokio::test(flavor = "multi_thread")]
async fn git_uncommitted_without_a_recorded_upload_keeps_its_cause_and_exit() {
    assert_checkout_failure("git-uncommitted", BuildFailure::UncommittedChanges).await;
}

#[tokio::test(flavor = "multi_thread")]
async fn removed_cli_code_without_a_recorded_upload_uses_exit() {
    assert_checkout_failure("build-stale", BuildFailure::Exit).await;
}

async fn assert_checkout_failure(cli_error: &str, cause: BuildFailure) {
    let Some((fixture, _)) = controlled_fixture() else {
        return;
    };
    let id = schedule(&fixture, 0);
    let step = Some(BuildStep::Publish);
    let worker = fixture.worker(
        runner(
            &fixture,
            BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: Some(1),
                cli_error: Some(MoklyCliCode::parse(cli_error)),
            },
            step,
            None,
            false,
        ),
        4,
    );
    let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
        panic!("the checkout failure must start");
    };
    assert_started(&fixture, id, 1, 2);
    worker.execute(*attempt).await.unwrap();
    let build = assert_finished(
        &fixture,
        id,
        BuildState::Failed,
        Some(cause),
        Some(1),
        step,
        4,
    );
    fixture.queries(&mut |queries| {
        let grant = queries
            .build_attempt_grant(id, build.attempt)
            .unwrap()
            .unwrap();
        assert!(grant.outcome.is_none());
        assert!(grant.consumed_at.is_none());
    });
}

#[tokio::test(flavor = "multi_thread")]
async fn failed_publish_grant_outcomes_and_cli_codes_finalize_in_postgres() {
    let Some((fixture, _)) = controlled_fixture() else {
        return;
    };
    for (index, (grant, code, cli_error, state, cause, exit)) in [
        (
            Some(UploadOutcome::Rejected),
            Some(4),
            Some("upload-failed"),
            BuildState::Failed,
            Some(BuildFailure::UploadRejected),
            Some(4),
        ),
        (
            Some(UploadOutcome::PlanRequired),
            Some(5),
            Some("upload-failed"),
            BuildState::Failed,
            Some(BuildFailure::PlanRequired),
            Some(5),
        ),
        (
            Some(UploadOutcome::Unavailable),
            Some(6),
            None,
            BuildState::Queued,
            None,
            None,
        ),
        (
            Some(UploadOutcome::Accepted),
            Some(7),
            None,
            BuildState::Queued,
            None,
            None,
        ),
        (
            None,
            Some(8),
            Some("upload-failed"),
            BuildState::Queued,
            None,
            None,
        ),
        (
            None,
            Some(9),
            Some("invalid-config"),
            BuildState::Failed,
            Some(BuildFailure::Exit),
            Some(9),
        ),
        (
            None,
            None,
            None,
            BuildState::Failed,
            Some(BuildFailure::Exit),
            None,
        ),
        (
            Some(UploadOutcome::Rejected),
            None,
            None,
            BuildState::Failed,
            Some(BuildFailure::UploadRejected),
            None,
        ),
        (
            Some(UploadOutcome::PlanRequired),
            None,
            None,
            BuildState::Failed,
            Some(BuildFailure::PlanRequired),
            None,
        ),
    ]
    .into_iter()
    .enumerate()
    {
        let id = schedule(&fixture, index);
        let step = Some(BuildStep::Publish);
        let worker = fixture.worker(
            runner(
                &fixture,
                BuildOutcome::StepFailed {
                    step: BuildStep::Publish,
                    exit_code: code,
                    cli_error: cli_error.map(MoklyCliCode::parse),
                },
                step,
                grant,
                false,
            ),
            4,
        );
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("case {index} must start");
        };
        assert_started(&fixture, id, 1, 2);
        worker.execute(*attempt).await.unwrap();
        assert_finished(&fixture, id, state, cause, exit, step, 4);
    }
}
