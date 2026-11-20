//! Configuration, repository, plan, setting and duplicate scheduling guards.

use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::github_installation::GitHubInstallationsMock;
use mkc_store_interface::github_repository::GitHubRepositoriesMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication::PublicationsMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::build_scheduler::{
    BuildReference, BuildSchedule, BuildScheduler, DatabaseBuildScheduler,
};
use crate::tests::build_fixtures::*;
use crate::tests::support::publication;

fn input(trigger: BuildTrigger) -> BuildSchedule {
    BuildSchedule {
        id: BUILD,
        project_id: PROJECT,
        trigger,
        reference: BuildReference::Branch(branch()),
        at: now(),
        rerun_base_ref: None,
    }
}

#[test]
fn unconfigured_scheduler_reads_nothing() {
    assert_eq!(
        DatabaseBuildScheduler { configured: false }
            .schedule(&mut Unimock::new(()), &input(BuildTrigger::Push))
            .unwrap(),
        None
    );
}

#[test]
fn every_unavailable_binding_skips() {
    for case in 0..7 {
        let mut project = Some(project());
        let mut repository = Some(repository());
        let mut installation = Some(installation());
        match case {
            0 => project = None,
            1 => repository = None,
            2 => repository.as_mut().unwrap().active = false,
            3 => installation = None,
            4 => installation.as_mut().unwrap().active = false,
            5 => installation.as_mut().unwrap().connected = false,
            6 => installation.as_mut().unwrap().organization_id = Some(Uuid::nil().into()),
            _ => unreachable!(),
        }
        let project_clause = || {
            ProjectsMock::project
                .some_call(matching!(_))
                .returns(Ok(project.clone()))
        };
        let repository_clause = || {
            GitHubRepositoriesMock::github_project_repository
                .some_call(matching!(_))
                .returns(Ok(repository.clone()))
        };
        let mut queries = match case {
            0 => Unimock::new(project_clause()),
            1 | 2 => Unimock::new((project_clause(), repository_clause())),
            _ => Unimock::new((
                project_clause(),
                repository_clause(),
                GitHubInstallationsMock::github_installation
                    .some_call(matching!(_))
                    .returns(Ok(installation)),
            )),
        };
        assert_eq!(
            DatabaseBuildScheduler { configured: true }
                .schedule(&mut queries, &input(BuildTrigger::Push))
                .unwrap(),
            None
        );
    }
}

#[test]
fn private_free_and_disabled_automatic_builds_skip() {
    for trigger in [
        BuildTrigger::Push,
        BuildTrigger::Setup,
        BuildTrigger::PullRequest,
    ] {
        for plan_blocked in [true, false] {
            let mut project = project();
            if plan_blocked {
                project.visibility = Visibility::Private;
            } else {
                project.automatic_builds = false;
            }
            let mut queries = Unimock::new(eligibility(
                Some(project),
                Some(repository()),
                Some(installation()),
                Plan::Free,
            ));
            assert_eq!(
                DatabaseBuildScheduler { configured: true }
                    .schedule(&mut queries, &input(trigger))
                    .unwrap(),
                None
            );
        }
    }
}

#[test]
fn ready_and_active_heads_skip_without_scheduling() {
    for ready in [true, false] {
        let common = || {
            (
                eligibility(
                    Some(project()),
                    Some(repository()),
                    Some(installation()),
                    Plan::Team,
                ),
                PublicationsMock::publication_by_identity
                    .some_call(matching!(_, _, _))
                    .returns(Ok(ready.then(publication))),
            )
        };
        let mut queries = if ready {
            Unimock::new(common())
        } else {
            Unimock::new((
                common(),
                BuildsMock::active_build
                    .some_call(matching!(_, _))
                    .returns(Ok(Some(build(BuildState::Running)))),
            ))
        };
        assert_eq!(
            DatabaseBuildScheduler { configured: true }
                .schedule(&mut queries, &input(BuildTrigger::Push))
                .unwrap(),
            None
        );
    }
}

#[test]
fn requests_and_reruns_ignore_automatic_builds() {
    for trigger in [BuildTrigger::Request, BuildTrigger::Rerun] {
        let mut project = project();
        project.automatic_builds = false;
        project.visibility = Visibility::Private;
        let mut queries = Unimock::new((
            eligibility(
                Some(project),
                Some(repository()),
                Some(installation()),
                Plan::Team,
            ),
            PublicationsMock::publication_by_identity
                .some_call(matching!(_, _, _))
                .returns(Ok(None)),
            BuildsMock::active_build
                .some_call(matching!(_, _))
                .returns(Ok(None)),
            BuildsMock::schedule_build
                .some_call(matching!(_))
                .returns(Ok(())),
        ));
        assert_eq!(
            DatabaseBuildScheduler { configured: true }
                .schedule(&mut queries, &input(trigger))
                .unwrap(),
            Some(BUILD)
        );
    }
}
