//! Trigger scope, fork refusal, duplicate guards and rerun comparison.

use std::sync::Arc;

use mkc_domain::values::Plan;
use mkc_store_interface::build::{BuildsMock, NewBuild};
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::publication::PublicationsMock;
use unimock::{MockFn, Unimock, matching};

use crate::build_scheduler::{
    BuildReference, BuildSchedule, BuildScheduler, DatabaseBuildScheduler,
};
use crate::tests::build_fixtures::*;

fn schedule(reference: BuildReference, trigger: BuildTrigger, expected_base: Option<&str>) {
    let base = expected_base.map(str::to_owned);
    let mut queries = Unimock::new((
        eligibility(
            Some(project()),
            Some(repository()),
            Some(installation()),
            Plan::Free,
        ),
        PublicationsMock::publication_by_identity
            .some_call(matching!(_, _, _))
            .returns(Ok(None)),
        BuildsMock::active_build
            .some_call(matching!(_, _))
            .returns(Ok(None)),
        BuildsMock::schedule_build
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, build: &NewBuild| {
                assert_eq!(build.base_ref, base);
                assert_eq!(build.id, BUILD);
                assert_eq!(build.created_at, now());
                Ok(())
            })),
    ));
    let scheduler: &dyn BuildScheduler = &DatabaseBuildScheduler { configured: true };
    let input = BuildSchedule {
        id: BUILD,
        project_id: PROJECT,
        reference,
        trigger,
        at: now(),
        rerun_base_ref: expected_base.map(str::to_owned),
    };
    assert_eq!(
        scheduler.schedule(&mut queries, &input).unwrap(),
        Some(BUILD)
    );
}

#[test]
fn every_branch_and_pull_request_trigger_has_its_documented_base() {
    schedule(BuildReference::Branch(branch()), BuildTrigger::Push, None);
    schedule(BuildReference::Branch(branch()), BuildTrigger::Setup, None);
    schedule(
        BuildReference::Branch(branch()),
        BuildTrigger::Request,
        None,
    );
    let mut feature = branch();
    feature.name = "feature".into();
    schedule(
        BuildReference::Branch(feature.clone()),
        BuildTrigger::Request,
        Some("main"),
    );
    schedule(
        BuildReference::Branch(feature),
        BuildTrigger::Rerun,
        Some("original-default"),
    );
    schedule(
        BuildReference::PullRequest(pull()),
        BuildTrigger::PullRequest,
        Some("main"),
    );
    schedule(
        BuildReference::PullRequest(pull()),
        BuildTrigger::Request,
        Some("main"),
    );
    schedule(
        BuildReference::PullRequest(pull()),
        BuildTrigger::Rerun,
        Some("original-base"),
    );
}

#[test]
fn unsupported_references_and_forks_never_read_or_write_the_outbox() {
    let mut deleted = branch();
    deleted.head_sha = None;
    let mut feature = branch();
    feature.name = "feature".into();
    let mut wrong = branch();
    wrong.repository_id = mkc_domain::ids::RepositoryId(uuid::Uuid::nil());
    let mut fork = pull();
    fork.head_repository_id = Some(200);
    let mut gone = pull();
    gone.head_repository_id = None;
    let mut wrong_base = pull();
    wrong_base.base_repository_id = Some(200);
    let mut closed = pull();
    closed.open = false;
    for (reference, trigger) in [
        (BuildReference::Branch(deleted), BuildTrigger::Push),
        (BuildReference::Branch(feature), BuildTrigger::Push),
        (BuildReference::Branch(wrong), BuildTrigger::Push),
        (BuildReference::PullRequest(fork), BuildTrigger::PullRequest),
        (BuildReference::PullRequest(gone), BuildTrigger::PullRequest),
        (
            BuildReference::PullRequest(wrong_base),
            BuildTrigger::PullRequest,
        ),
        (
            BuildReference::PullRequest(closed),
            BuildTrigger::PullRequest,
        ),
        (BuildReference::PullRequest(pull()), BuildTrigger::Push),
        (BuildReference::Branch(branch()), BuildTrigger::PullRequest),
    ] {
        let mut queries = Unimock::new(eligibility(
            Some(project()),
            Some(repository()),
            Some(installation()),
            Plan::Free,
        ));
        let input = BuildSchedule {
            id: BUILD,
            project_id: PROJECT,
            trigger,
            reference,
            at: now(),
            rerun_base_ref: None,
        };
        assert_eq!(
            DatabaseBuildScheduler { configured: true }
                .schedule(&mut queries, &input)
                .unwrap(),
            None
        );
    }
}
