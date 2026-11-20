//! Claim refusal, lease recovery, attempt grants and process capacity.

use std::sync::Arc;

use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use mkc_store_interface::github_repository::GitHubRepositoriesMock;
use mkc_store_interface::project::ProjectsMock;
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::BuildClaim;
use crate::tests::build_fixtures::*;

use super::support::{start_queries, worker};

#[test]
fn claim_rejects_repository_and_plan_before_start() {
    for repository_missing in [true, false] {
        let mut project = project();
        project.visibility = Visibility::Private;
        let cause = if repository_missing {
            BuildFailure::RepositoryUnavailable
        } else {
            BuildFailure::PlanRequired
        };
        let common = || {
            (
                BuildsMock::claim_build
                    .some_call(matching!(_))
                    .returns(Ok(Some(build(BuildState::Queued)))),
                BuildsMock::finish_build
                    .some_call(matching!(_, None, _))
                    .answers_arc(Arc::new(move |_, _, _, value| {
                        assert_eq!(value.state, BuildState::Failed);
                        assert_eq!(value.failure_cause, Some(cause));
                        Ok(true)
                    })),
            )
        };
        let queries = if repository_missing {
            Unimock::new((
                common(),
                ProjectsMock::project
                    .some_call(matching!(_))
                    .returns(Ok(Some(project))),
                GitHubRepositoriesMock::github_project_repository
                    .some_call(matching!(_))
                    .returns(Ok(None)),
            ))
        } else {
            Unimock::new((
                common(),
                eligibility(
                    Some(project),
                    Some(repository()),
                    Some(installation()),
                    Plan::Free,
                ),
            ))
        };
        assert!(matches!(
            worker(
                queries,
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                4
            )
            .claim()
            .unwrap(),
            BuildClaim::Handled
        ));
    }
}

#[test]
fn expired_leases_publish_committed_uploads_and_retry_or_exhaust_others() {
    for (published, attempt) in [(true, 1), (false, 1), (false, 5)] {
        let mut running = build(BuildState::Running);
        running.attempt = attempt;
        if published {
            running.publication_id = Some(uuid::Uuid::from_u128(7).into());
        }
        let queries = Unimock::new((
            BuildsMock::claim_build
                .some_call(matching!(_))
                .returns(Ok(Some(running))),
            super::support::expiration(),
            BuildsMock::finish_build
                .some_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, lease, value| {
                    assert_eq!(lease, Some(LEASE));
                    assert_eq!(
                        value.state,
                        if published {
                            BuildState::Published
                        } else if attempt == 5 {
                            BuildState::Failed
                        } else {
                            BuildState::Queued
                        }
                    );
                    Ok(true)
                })),
        ));
        assert!(matches!(
            worker(
                queries,
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                4
            )
            .claim()
            .unwrap(),
            BuildClaim::Handled
        ));
    }
}

#[test]
fn process_capacity_skips_queries_until_owned_attempt_is_released() {
    let queries = Unimock::new((
        eligibility(
            Some(project()),
            Some(repository()),
            Some(installation()),
            Plan::Free,
        ),
        start_queries(),
    ));
    let worker = worker(
        queries,
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        1,
    );
    {
        let first = worker.claim().unwrap();
        assert!(matches!(first, BuildClaim::Attempt(_)));
        assert!(matches!(worker.claim().unwrap(), BuildClaim::Idle));
    }
    assert!(matches!(worker.claim().unwrap(), BuildClaim::Attempt(_)));
}

#[test]
fn organization_limit_is_owned_by_the_claim_and_start_queries() {
    let queries = Unimock::new(BuildsMock::claim_build.some_call(matching!(_)).answers(
        &|_, clock| {
            assert_eq!(clock.now(), now());
            Ok(None)
        },
    ));
    assert!(matches!(
        worker(
            queries,
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            4
        )
        .claim()
        .unwrap(),
        BuildClaim::Idle
    ));
}
