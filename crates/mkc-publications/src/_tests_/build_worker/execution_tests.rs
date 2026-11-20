//! Runner dispatch, safe credential refusal and publication-winning finalization.

use std::sync::{Arc, Mutex};

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::runner::BuildRunnerMock;
use mkc_domain::values::Plan;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_github_interface::error::Error;
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_grant::BuildUploadGrantsMock;
use mkc_store_interface::build_log::BuildLogsMock;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::BuildClaim;
use crate::tests::build_fixtures::*;

use super::support::{clock, start_queries, worker};

#[tokio::test]
async fn runner_receives_exact_grant_endpoint_and_repository_and_sink_persists_progress() {
    let mut running = build(BuildState::Running);
    running.attempt_operation_id = Some(LEASE);
    let queries = Unimock::new((
        eligibility(
            Some(project()),
            Some(repository()),
            Some(installation()),
            Plan::Free,
        ),
        start_queries(),
        BuildsMock::set_build_step
            .some_call(matching!(_, _, _, _))
            .answers(&|_, id, lease, step, _| {
                assert_eq!(id, BUILD);
                assert_eq!(lease, LEASE);
                assert_eq!(step.as_str(), "checkout");
                Ok(true)
            }),
        BuildLogsMock::append_build_log
            .some_call(matching!(_, _))
            .answers(&|_, id, chunk| {
                assert_eq!(id, BUILD);
                assert_eq!(chunk.attempt_operation_id, LEASE);
                assert_eq!(chunk.bytes, b"safe\n");
                Ok(true)
            }),
        BuildsMock::build
            .some_call(matching!(_, _))
            .returns(Ok(Some(running))),
        BuildUploadGrantsMock::build_attempt_grant
            .some_call(matching!(_, 1))
            .returns(Ok(None)),
        super::support::expiration(),
        BuildsMock::finish_build
            .some_call(matching!(_, _, _))
            .answers(&|_, _, _, value| {
                assert_eq!(value.state, BuildState::Queued);
                assert_eq!((value.next_attempt_at - now()).num_seconds(), 60);
                Ok(true)
            }),
    ));
    let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers(
        &|_, request, sink| {
            Box::pin(async move {
                assert_eq!(request.repository.as_str(), project().repository);
                assert_eq!(request.attempt_operation_id, LEASE);
                assert_eq!(request.installation_token.expose(), "scoped-token");
                assert!(request.upload_token.expose().starts_with("mkb_"));
                assert_eq!(
                    request.upload_endpoint.as_str(),
                    format!("https://api.example.com/v1/projects/{PROJECT}/publications")
                );
                assert!(!format!("{request:?}").contains("scoped-token"));
                sink.step_started(LEASE, BuildStep::Checkout).await.unwrap();
                sink.write(mkc_build_interface::log::BuildLogChunk {
                    attempt_operation_id: LEASE,
                    step: BuildStep::Checkout,
                    stream: mkc_build_interface::log::BuildStream::Stdout,
                    bytes: b"safe\n".to_vec(),
                })
                .await
                .unwrap();
                BuildOutcome::Completed
            })
        },
    ));
    let credentials = Unimock::new(
        TokensMock::repository_read
            .some_call(matching!(1, 100))
            .returns(Ok(Secret::new("scoped-token".into()))),
    );
    let worker = worker(queries, Arc::new(credentials), Arc::new(runner), clock(), 4);
    let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
        panic!("attempt required");
    };
    worker.execute(*attempt).await.unwrap();
}

#[tokio::test]
async fn token_access_failures_end_immediately_and_other_failures_retry() {
    for (error, cause) in [
        (Error::Forbidden, Some(BuildFailure::RepositoryUnavailable)),
        (Error::NotFound, Some(BuildFailure::RepositoryUnavailable)),
        (Error::Unavailable, None),
        (Error::RateLimited { retry_after: 60 }, None),
    ] {
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
            super::support::expiration(),
            BuildsMock::finish_build
                .some_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, _, value| {
                    assert_eq!(value.failure_cause, cause);
                    assert_eq!(
                        value.state,
                        if cause.is_some() {
                            BuildState::Failed
                        } else {
                            BuildState::Queued
                        }
                    );
                    Ok(true)
                })),
        ));
        let credentials = Unimock::new(
            TokensMock::repository_read
                .some_call(matching!(1, 100))
                .returns(Err(error)),
        );
        let worker = worker(
            queries,
            Arc::new(credentials),
            Arc::new(Unimock::new(())),
            clock(),
            4,
        );
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("attempt required");
        };
        worker.execute(*attempt).await.unwrap();
    }
}

#[tokio::test]
async fn committed_publication_wins_over_all_runner_failures() {
    for outcome in [
        BuildOutcome::Completed,
        BuildOutcome::UnsupportedLockfile,
        BuildOutcome::UnsupportedMoklyVersion,
        BuildOutcome::StepFailed {
            step: BuildStep::Publish,
            exit_code: Some(1),
            cli_error: Some(MoklyCliCode::UploadFailed),
        },
    ] {
        let mut running = build(BuildState::Running);
        running.publication_id = Some(uuid::Uuid::from_u128(99).into());
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
                .returns(Ok(Some(running))),
            super::support::expiration(),
            BuildsMock::finish_build
                .some_call(matching!(_, _, _))
                .answers(&|_, _, _, value| {
                    assert_eq!(value.state, BuildState::Published);
                    assert!(value.failure_cause.is_none());
                    Ok(true)
                }),
        ));
        let credentials = Unimock::new(
            TokensMock::repository_read
                .some_call(matching!(1, 100))
                .returns(Ok(Secret::new("scoped".into()))),
        );
        let outcome = Mutex::new(Some(outcome));
        let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers_arc(
            Arc::new(move |_, _, _| {
                let outcome = outcome.lock().unwrap().take().unwrap();
                Box::pin(async move { outcome })
            }),
        ));
        let worker = worker(queries, Arc::new(credentials), Arc::new(runner), clock(), 4);
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("attempt required");
        };
        worker.execute(*attempt).await.unwrap();
    }
}
