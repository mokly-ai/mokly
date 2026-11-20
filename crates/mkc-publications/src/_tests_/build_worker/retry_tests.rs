//! Retry delays and exhaustion through the worker's claimed attempt lifecycle.

use std::sync::Arc;

use mkc_build_interface::outcome::BuildOutcome;
use mkc_build_interface::runner::BuildRunnerMock;
use mkc_domain::values::Plan;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_grant::BuildUploadGrantsMock;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::BuildClaim;
use crate::tests::build_fixtures::*;

use super::support::{clock, start_queries_at, worker};

#[tokio::test]
async fn completed_without_upload_retries_four_times_and_then_exhausts() {
    for (number, delay) in [
        (1, Some(60)),
        (2, Some(120)),
        (3, Some(240)),
        (4, Some(480)),
        (5, None),
    ] {
        let mut running = build(BuildState::Running);
        running.attempt = number;
        let queries = Unimock::new((
            eligibility(
                Some(project()),
                Some(repository()),
                Some(installation()),
                Plan::Free,
            ),
            start_queries_at(number),
            BuildsMock::build
                .some_call(matching!(_, _))
                .returns(Ok(Some(running))),
            BuildUploadGrantsMock::build_attempt_grant
                .some_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, id, attempt| {
                    assert_eq!((id, attempt), (BUILD, number));
                    Ok(None)
                })),
            super::support::expiration(),
            BuildsMock::finish_build
                .some_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, id, lease, value| {
                    assert_eq!((id, lease), (BUILD, Some(LEASE)));
                    match delay {
                        Some(seconds) => {
                            assert_eq!(value.state, BuildState::Queued);
                            assert!(value.failure_cause.is_none());
                            assert_eq!((value.next_attempt_at - now()).num_seconds(), seconds);
                        }
                        None => {
                            assert_eq!(value.state, BuildState::Failed);
                            assert_eq!(value.failure_cause, Some(BuildFailure::Infrastructure));
                        }
                    }
                    Ok(true)
                })),
        ));
        let credentials = Unimock::new(
            TokensMock::repository_read
                .some_call(matching!(1, 100))
                .returns(Ok(Secret::new("scoped".into()))),
        );
        let runner = Unimock::new(
            BuildRunnerMock::run
                .some_call(matching!(_, _))
                .answers(&|_, _, _| Box::pin(async { BuildOutcome::Completed })),
        );
        let worker = worker(queries, Arc::new(credentials), Arc::new(runner), clock(), 4);
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("attempt required");
        };
        worker.execute(*attempt).await.unwrap();
    }
}
