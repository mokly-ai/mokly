//! Rerequest consumption validates exact identities and commits only query effects.

use std::io;
use std::sync::Arc;

use mkc_auth::runtime::RuntimeMock;
use mkc_domain::ids::RepositoryId;
use mkc_store_interface::github_check::{CheckRun, GitHubChecksMock};
use mkc_store_interface::github_repository::{GitHubRepositoriesMock, Repository};
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::publication_event::{EventKind, PublicationEventsMock};
use mkc_store_interface::store::{StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::check_rerequests::{CheckRerequests, PublicationCheckRerequests};

use super::support::{PROJECT, PUBLICATION, now, publication};

fn check() -> CheckRun {
    CheckRun {
        id: Uuid::from_u128(42),
        project_id: PROJECT,
        repository_id: RepositoryId(Uuid::from_u128(43)),
        github_id: 4,
        external_id: format!("mokly-publication:{PUBLICATION}"),
        head_sha: "b".repeat(40),
        rerequested: true,
    }
}

fn repository() -> Repository {
    Repository {
        id: check().repository_id,
        installation_id: Uuid::from_u128(45).into(),
        github_id: 1,
        full_name: "Owner/Renamed".into(),
        default_branch: "main".into(),
        private: false,
        active: true,
    }
}

fn worker(queries: Unimock) -> PublicationCheckRerequests {
    PublicationCheckRerequests {
        store: Arc::new(Unimock::new(
            StoreMock::transaction
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                    work.run(&mut queries.clone())?;
                    Ok(())
                })),
        )),
        runtime: Arc::new(Unimock::new((
            RuntimeMock::now.next_call(matching!()).returns(now()),
            RuntimeMock::id
                .each_call(matching!())
                .returns(Uuid::from_u128(44))
                .n_times(100),
        ))),
    }
}

#[test]
fn valid_mark_inserts_a_fresh_due_event_then_clears_the_mark() {
    let queries = Unimock::new((
        GitHubChecksMock::rerequested_github_checks
            .next_call(matching!("mokly-publication:", 100))
            .returns(Ok(vec![check()])),
        PublicationsMock::publication
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(Some(publication()))),
        GitHubRepositoriesMock::github_project_repository
            .next_call(matching!(&PROJECT))
            .returns(Ok(Some(repository()))),
        PublicationEventsMock::insert_publication_event
            .next_call(matching!(_))
            .answers(&|_, event| {
                assert_eq!(event.kind, EventKind::Rerequest);
                assert_eq!(event.publication_id, PUBLICATION);
                assert_eq!(event.id, Uuid::from_u128(44));
                assert_eq!(event.created_at, now());
                Ok(())
            }),
        GitHubChecksMock::clear_github_check_rerequest
            .next_call(matching!(_))
            .returns(Ok(())),
    ));
    let worker: &dyn CheckRerequests = &worker(queries);
    assert_eq!(worker.run_batch().unwrap(), 1);
}

#[test]
fn wrong_project_or_head_clears_a_stale_mark_without_an_event() {
    for case in ["project", "head"] {
        let mut value = publication();
        if case == "project" {
            value.project_id = Uuid::from_u128(999).into();
        } else {
            value.metadata.as_mut().unwrap().head_sha = "c".repeat(40);
        }
        let queries = Unimock::new((
            GitHubChecksMock::rerequested_github_checks
                .next_call(matching!("mokly-publication:", 100))
                .returns(Ok(vec![check()])),
            PublicationsMock::publication
                .next_call(matching!(_))
                .returns(Ok(Some(value))),
            GitHubChecksMock::clear_github_check_rerequest
                .next_call(matching!(_))
                .returns(Ok(())),
        ));
        assert_eq!(worker(queries).run_batch().unwrap(), 0);
    }
}

#[test]
fn malformed_external_id_is_consumed_without_reading_a_publication() {
    let mut value = check();
    value.external_id = "mokly-publication:invalid".into();
    let queries = Unimock::new((
        GitHubChecksMock::rerequested_github_checks
            .next_call(matching!("mokly-publication:", 100))
            .returns(Ok(vec![value])),
        GitHubChecksMock::clear_github_check_rerequest
            .next_call(matching!(_))
            .returns(Ok(())),
    ));
    assert_eq!(worker(queries).run_batch().unwrap(), 0);
}

#[test]
fn query_failure_aborts_before_clearing_the_mark() {
    let queries = Unimock::new((
        GitHubChecksMock::rerequested_github_checks
            .next_call(matching!("mokly-publication:", 100))
            .returns(Ok(vec![check()])),
        PublicationsMock::publication
            .next_call(matching!(_))
            .returns(Err(mkc_store_interface::error::Error::internal(
                io::Error::other("database failure"),
            ))),
    ));
    assert!(worker(queries).run_batch().is_err());
}

#[test]
fn wrong_or_absent_repository_clears_the_mark_without_an_event() {
    for binding in [
        Some(Repository {
            id: Uuid::from_u128(999).into(),
            ..repository()
        }),
        None,
    ] {
        let queries = Unimock::new((
            GitHubChecksMock::rerequested_github_checks
                .next_call(matching!("mokly-publication:", 100))
                .returns(Ok(vec![check()])),
            PublicationsMock::publication
                .next_call(matching!(_))
                .returns(Ok(Some(publication()))),
            GitHubRepositoriesMock::github_project_repository
                .next_call(matching!(_))
                .returns(Ok(binding)),
            GitHubChecksMock::clear_github_check_rerequest
                .next_call(matching!(_))
                .returns(Ok(())),
        ));
        assert_eq!(worker(queries).run_batch().unwrap(), 0);
    }
}

#[test]
fn event_write_failure_aborts_before_clearing_the_mark() {
    let queries = Unimock::new((
        GitHubChecksMock::rerequested_github_checks
            .next_call(matching!("mokly-publication:", 100))
            .returns(Ok(vec![check()])),
        PublicationsMock::publication
            .next_call(matching!(_))
            .returns(Ok(Some(publication()))),
        GitHubRepositoriesMock::github_project_repository
            .next_call(matching!(_))
            .returns(Ok(Some(repository()))),
        PublicationEventsMock::insert_publication_event
            .next_call(matching!(_))
            .returns(Err(mkc_store_interface::error::Error::internal(
                io::Error::other("database failure"),
            ))),
    ));
    assert!(worker(queries).run_batch().is_err());
}
