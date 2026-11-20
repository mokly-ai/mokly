//! Stored pull request identities protect re-runs and preserve comparison mode.

use std::sync::Arc;

use mkc_domain::values::Plan;
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_check::BuildChecksMock;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::github_check::{CheckRun, GitHubChecksMock};
use mkc_store_interface::github_refs::GitHubRefsMock;
use mkc_store_interface::github_repository::GitHubRepositoriesMock;
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::store::{StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};

use crate::build_check_rerequests::BuildCheckRerequests;
use crate::build_scheduler::DatabaseBuildScheduler;
use crate::check_rerequests::CheckRerequests;

use super::build_fixtures::*;

#[test]
fn pull_request_reruns_use_stored_fork_ids_and_the_original_base_and_branch() {
    for (head_repository, base_repository, open, current) in [
        (Some(100), Some(100), true, true),
        (Some(200), Some(100), true, true),
        (None, Some(100), true, true),
        (Some(100), None, true, true),
        (Some(100), Some(200), true, true),
        (Some(100), Some(100), false, true),
        (Some(100), Some(100), true, false),
    ] {
        let eligible =
            head_repository == Some(100) && base_repository == Some(100) && open && current;
        let mut project = project();
        project.automatic_builds = false;
        let mut original = build(BuildState::Failed);
        original.branch = "original-branch".into();
        original.pull_request = Some(3);
        original.base_ref = Some("original-base".into());
        let mut observed = pull();
        observed.head_repository_id = head_repository;
        observed.base_repository_id = base_repository;
        observed.head_ref = "changed-branch".into();
        observed.base_ref = "changed-base".into();
        observed.open = open;
        if !current {
            observed.head_sha = "c".repeat(40);
        }
        let common = || {
            (
                GitHubChecksMock::rerequested_github_checks
                    .some_call(matching!("mokly-build:", 100))
                    .returns(Ok(vec![CheckRun {
                        id: LEASE,
                        project_id: PROJECT,
                        repository_id: REPOSITORY,
                        github_id: 50,
                        head_sha: original.head_sha.clone(),
                        external_id: format!("mokly-build:{BUILD}"),
                        rerequested: true,
                    }])),
                BuildsMock::build
                    .some_call(matching!(_, _))
                    .returns(Ok(Some(original.clone()))),
                GitHubRefsMock::github_pull_requests
                    .some_call(matching!(_))
                    .returns(Ok(vec![observed.clone()])),
                GitHubChecksMock::clear_github_check_rerequest
                    .some_call(matching!(_))
                    .returns(Ok(())),
            )
        };
        let access = || {
            eligibility(
                Some(project.clone()),
                Some(repository()),
                Some(installation()),
                Plan::Free,
            )
        };
        let queries = if eligible {
            Unimock::new((
                common(),
                access(),
                PublicationsMock::publication_by_identity
                    .some_call(matching!(_, _, _))
                    .returns(Ok(None)),
                BuildsMock::active_build
                    .some_call(matching!(_, _))
                    .returns(Ok(None)),
                BuildsMock::schedule_build
                    .some_call(matching!(_))
                    .answers(&|_, value| {
                        assert_eq!(value.trigger, BuildTrigger::Rerun);
                        assert_eq!(value.head_sha, "a".repeat(40));
                        assert_eq!(value.branch, "original-branch");
                        assert_eq!(value.base_ref.as_deref(), Some("original-base"));
                        assert_eq!(value.pull_request, Some(3));
                        Ok(())
                    }),
            ))
        } else if current {
            Unimock::new((
                common(),
                access(),
                BuildChecksMock::bump_build_check
                    .some_call(matching!(_, _))
                    .returns(Ok(())),
            ))
        } else {
            Unimock::new((
                common(),
                GitHubRepositoriesMock::github_project_repository
                    .some_call(matching!(_))
                    .returns(Ok(Some(repository()))),
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
        let consumer: &dyn CheckRerequests = &BuildCheckRerequests {
            store: Arc::new(store),
            scheduler: Arc::new(DatabaseBuildScheduler { configured: true }),
            runtime: id_runtime(),
        };
        assert_eq!(consumer.run_batch().unwrap(), 1);
    }
}
