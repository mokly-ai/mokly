//! Build check re-run policy and atomic mark consumption.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_check::BuildChecksMock;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::github_check::{CheckRun, GitHubChecksMock};
use mkc_store_interface::github_refs::GitHubRefsMock;
use mkc_store_interface::github_repository::GitHubRepositoriesMock;
use mkc_store_interface::store::{StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::build_check_rerequests::BuildCheckRerequests;
use crate::build_scheduler::BuildSchedulerMock;
use crate::check_rerequests::CheckRerequests;
use crate::tests::build_fixtures::*;

fn check_run() -> CheckRun {
    CheckRun {
        id: Uuid::from_u128(30),
        project_id: PROJECT,
        repository_id: REPOSITORY,
        github_id: 50,
        head_sha: "a".repeat(40),
        external_id: format!("mokly-build:{BUILD}"),
        rerequested: true,
    }
}

#[test]
fn only_failed_timed_out_or_cancelled_current_heads_schedule_a_rebuild() {
    for state in [
        BuildState::Queued,
        BuildState::Running,
        BuildState::Published,
        BuildState::Failed,
        BuildState::TimedOut,
        BuildState::Superseded,
        BuildState::Cancelled,
    ] {
        for current in [true, false] {
            let mut branch = branch();
            if !current {
                branch.head_sha = Some("b".repeat(40));
            }
            let rebuild = current
                && matches!(
                    state,
                    BuildState::Failed | BuildState::TimedOut | BuildState::Cancelled
                );
            let common = || {
                (
                    GitHubChecksMock::rerequested_github_checks
                        .some_call(matching!("mokly-build:", 100))
                        .returns(Ok(vec![check_run()])),
                    BuildsMock::build
                        .some_call(matching!(_, _))
                        .returns(Ok(Some(build(state)))),
                    GitHubRepositoriesMock::github_project_repository
                        .some_call(matching!(_))
                        .returns(Ok(Some(repository()))),
                    GitHubChecksMock::clear_github_check_rerequest
                        .some_call(matching!(_))
                        .returns(Ok(())),
                )
            };
            let queries = if rebuild {
                Unimock::new((
                    common(),
                    GitHubRefsMock::github_branches
                        .some_call(matching!(_))
                        .returns(Ok(vec![branch.clone()])),
                ))
            } else if matches!(
                state,
                BuildState::Failed | BuildState::TimedOut | BuildState::Cancelled
            ) {
                Unimock::new((
                    common(),
                    GitHubRefsMock::github_branches
                        .some_call(matching!(_))
                        .returns(Ok(vec![branch.clone()])),
                    BuildChecksMock::bump_build_check
                        .some_call(matching!(_, _))
                        .returns(Ok(())),
                ))
            } else {
                Unimock::new((
                    common(),
                    BuildChecksMock::bump_build_check
                        .some_call(matching!(_, _))
                        .returns(Ok(())),
                ))
            };
            let store = Unimock::new(StoreMock::transaction.some_call(matching!(_)).answers_arc(
                Arc::new(move |_, work: &mut dyn Transaction| {
                    work.run(&mut queries.clone())?;
                    Ok(())
                }),
            ));
            let scheduler = if rebuild {
                Unimock::new(
                    BuildSchedulerMock::schedule
                        .some_call(matching!(_, _))
                        .answers(&|_, _, request| {
                            assert_eq!(request.trigger, BuildTrigger::Rerun);
                            Ok(Some(BUILD))
                        }),
                )
            } else {
                Unimock::new(())
            };
            let consumer: &dyn CheckRerequests = &BuildCheckRerequests {
                store: Arc::new(store),
                scheduler: Arc::new(scheduler),
                runtime: id_runtime(),
            };
            assert_eq!(consumer.run_batch().unwrap(), 1);
        }
    }
}

#[test]
fn ineligible_current_head_redelivers_and_mismatched_identity_only_clears_the_mark() {
    for mismatch in [true, false] {
        let mut check = check_run();
        if mismatch {
            check.head_sha = "b".repeat(40);
        }
        let common = || {
            (
                GitHubChecksMock::rerequested_github_checks
                    .some_call(matching!(_, _))
                    .returns(Ok(vec![check.clone()])),
                BuildsMock::build
                    .some_call(matching!(_, _))
                    .returns(Ok(Some(build(BuildState::Failed)))),
                GitHubChecksMock::clear_github_check_rerequest
                    .some_call(matching!(_))
                    .returns(Ok(())),
            )
        };
        let queries = if mismatch {
            Unimock::new(common())
        } else {
            Unimock::new((
                common(),
                GitHubRepositoriesMock::github_project_repository
                    .some_call(matching!(_))
                    .returns(Ok(Some(repository()))),
                GitHubRefsMock::github_branches
                    .some_call(matching!(_))
                    .returns(Ok(vec![branch()])),
                BuildChecksMock::bump_build_check
                    .some_call(matching!(_, _))
                    .returns(Ok(())),
            ))
        };
        let store = Unimock::new(StoreMock::transaction.some_call(matching!(_)).answers_arc(
            Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut queries.clone())?;
                Ok(())
            }),
        ));
        let scheduler = if mismatch {
            Unimock::new(())
        } else {
            Unimock::new(
                BuildSchedulerMock::schedule
                    .some_call(matching!(_, _))
                    .returns(Ok(None)),
            )
        };
        let consumer: &dyn CheckRerequests = &BuildCheckRerequests {
            store: Arc::new(store),
            scheduler: Arc::new(scheduler),
            runtime: id_runtime(),
        };
        assert_eq!(consumer.run_batch().unwrap(), usize::from(!mismatch));
    }
}
