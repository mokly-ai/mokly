//! Claims happen per row and published builds use the shared result renderer.

use std::sync::Arc;

use mkc_github_interface::check::{CheckRunsMock, Error};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_check::BuildChecksMock;
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication::PublicationsMock;
use unimock::{Clause, MockFn, Unimock, matching};

use crate::build_check_worker::{BuildCheckDelivery, BuildChecksWorker};
use crate::check_delivery::CheckRendererMock;
use crate::tests::build_fixtures::*;

fn worker(queries: Unimock, github: Unimock, renderer: Unimock) -> BuildCheckDelivery {
    BuildCheckDelivery {
        transactions: transactions(queries),
        github: Arc::new(github),
        publications: Arc::new(renderer),
        runtime: clock_runtime(),
        locations: locations(),
    }
}

fn context() -> impl Clause {
    (
        ProjectsMock::project
            .some_call(matching!(_))
            .returns(Ok(Some(project()))),
        OrganizationsMock::organization
            .some_call(matching!(_))
            .returns(Ok(Some(organization(mkc_domain::values::Plan::Free)))),
    )
}

fn pending() -> impl Clause {
    BuildChecksMock::pending_build_checks
        .some_call(matching!(_, 100, None))
        .returns(Ok(vec![check()]))
}

fn claim() -> impl Clause {
    let mut claim = check();
    claim.attempts = 1;
    BuildChecksMock::claim_build_check
        .some_call(matching!(_, 0, _))
        .returns(Ok(Some(claim)))
}

#[test]
fn lost_claim_skips_every_build_file_and_provider_read() {
    let queries = Unimock::new((
        pending(),
        BuildChecksMock::claim_build_check
            .some_call(matching!(_, 0, _))
            .returns(Ok(None)),
    ));
    assert_eq!(
        worker(queries, Unimock::new(()), Unimock::new(()))
            .run_batch(None)
            .unwrap(),
        0
    );
}

#[test]
fn success_acknowledges_only_the_claimed_version_and_fenced_outcomes_count_nothing() {
    for recorded in [true, false] {
        let queries = Unimock::new((
            pending(),
            claim(),
            context(),
            BuildsMock::build_by_id
                .some_call(matching!(_))
                .returns(Ok(Some(build(BuildState::Queued)))),
            BuildChecksMock::deliver_build_check
                .some_call(matching!(_, 1, 1))
                .returns(Ok(recorded)),
        ));
        let github = Unimock::new(CheckRunsMock::upsert.some_call(matching!(_)).answers(
            &|_, value| {
                assert_eq!(value.external_id, format!("mokly-build:{BUILD}"));
                assert!(value.details_url.ends_with(&format!("/builds/{BUILD}")));
                assert_eq!(value.title, "Waiting to publish");
                Ok(())
            },
        ));
        assert_eq!(
            worker(queries, github, Unimock::new(()))
                .run_batch(None)
                .unwrap(),
            usize::from(recorded)
        );
    }
}

#[test]
fn provider_failure_records_claim_attempts_permanent_class_and_preclaim_backoff() {
    for (provider, permanent) in [
        (Error::Validation, true),
        (
            Error::Http {
                status: 503,
                rate_limited: false,
            },
            false,
        ),
    ] {
        let queries = Unimock::new((
            pending(),
            claim(),
            context(),
            BuildsMock::build_by_id
                .some_call(matching!(_))
                .returns(Ok(Some(build(BuildState::Queued)))),
            BuildChecksMock::retry_build_check
                .some_call(matching!(_, _, _, _, _))
                .answers_arc(Arc::new(move |_, _, attempts, is_permanent, next, at| {
                    assert_eq!(attempts, 1);
                    assert_eq!(is_permanent, permanent);
                    assert_eq!((next - at).num_seconds(), 60);
                    Ok(true)
                })),
        ));
        let github = Unimock::new(
            CheckRunsMock::upsert
                .some_call(matching!(_))
                .returns(Err(provider)),
        );
        assert_eq!(
            worker(queries, github, Unimock::new(()))
                .run_batch(None)
                .unwrap(),
            0
        );
    }
}

#[test]
fn published_build_reuses_publication_rendering_and_keeps_build_identity() {
    let publication = publication();
    let mut published = build(BuildState::Published);
    published.publication_id = Some(publication.id);
    let queries = Unimock::new((
        pending(),
        claim(),
        context(),
        BuildsMock::build_by_id
            .some_call(matching!(_))
            .returns(Ok(Some(published))),
        PublicationsMock::publication
            .some_call(matching!(_))
            .returns(Ok(Some(publication))),
        BuildChecksMock::deliver_build_check
            .some_call(matching!(_, 1, 1))
            .returns(Ok(true)),
    ));
    let renderer = Unimock::new(
        CheckRendererMock::render
            .some_call(matching!(_, _, _))
            .answers(&|_, _, _, _| {
                Ok(Some(mkc_github_interface::check::CheckRun {
                    project_id: PROJECT,
                    repository: project().repository,
                    head_sha: "a".repeat(40),
                    external_id: "publication-id".into(),
                    name: "Mokly".into(),
                    status: mkc_github_interface::checks::Status::Completed,
                    conclusion: Some(mkc_github_interface::check::Conclusion::Success),
                    title: "Catalogue ready to review.".into(),
                    summary: "1 changed. View Changes".into(),
                    details_url: "publication-url".into(),
                }))
            }),
    );
    let github = Unimock::new(CheckRunsMock::upsert.some_call(matching!(_)).answers(
        &|_, check| {
            assert_eq!(check.external_id, format!("mokly-build:{BUILD}"));
            assert_eq!(check.summary, "1 changed. View Changes");
            assert!(check.details_url.ends_with(&format!("/builds/{BUILD}")));
            Ok(())
        },
    ));
    assert_eq!(
        worker(queries, github, renderer).run_batch(None).unwrap(),
        1
    );
}
