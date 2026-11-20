//! Invalid execution input ends the owned attempt without calling the runner.

use std::sync::Arc;

use mkc_domain::values::Plan;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_state::BuildState;
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::BuildClaim;
use crate::tests::build_fixtures::*;

use super::support::{clock, start_queries, worker};

#[tokio::test]
async fn invalid_repository_or_secret_retries_without_exposing_the_value() {
    for invalid_repository in [true, false] {
        let mut repository = repository();
        if invalid_repository {
            repository.full_name = "invalid-repository".into();
        }
        let queries = Unimock::new((
            eligibility(
                Some(project()),
                Some(repository),
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
                .answers(&|_, id, lease, value| {
                    assert_eq!((id, lease), (BUILD, Some(LEASE)));
                    assert_eq!(value.state, BuildState::Queued);
                    assert_eq!((value.next_attempt_at - now()).num_seconds(), 60);
                    Ok(true)
                }),
        ));
        let token = if invalid_repository { "scoped" } else { "" };
        let credentials = Unimock::new(
            TokensMock::repository_read
                .some_call(matching!(1, 100))
                .returns(Ok(Secret::new(token.into()))),
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
