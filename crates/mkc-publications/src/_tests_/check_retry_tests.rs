//! One repository's failed delivery must not starve the global outbox.

use std::sync::Arc;

use chrono::Duration;
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_github_interface::check::{CheckRunsMock, Error as CheckError};
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::publication_event::{
    EventKind, PendingEvent, PublicationEvent, PublicationEventsMock,
};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::check_worker::{ChecksWorker, PublicationChecks};

use super::check_fixture;
use super::support::{
    PROJECT, PUBLICATION, claim, clock, locations, now, organization_query, project, publication,
    transactions,
};

const SECOND_PROJECT: ProjectId = ProjectId(Uuid::from_u128(10));

const SECOND: PublicationId = PublicationId(Uuid::from_u128(9));

#[test]
fn permanently_failing_first_repository_does_not_starve_second_event() {
    let first = publication();
    let mut second = publication();
    second.id = SECOND;
    second.project_id = SECOND_PROJECT;
    let mut healthy = project();
    healthy.id = SECOND_PROJECT;
    healthy.repository = "another-tenant/healthy".into();
    let events = [first.id, second.id]
        .into_iter()
        .map(|id| PendingEvent {
            attempts: 0,
            permanent_failures: 0,
            event: PublicationEvent {
                id: id.0,
                publication_id: id,
                kind: EventKind::Ready,
                created_at: now(),
            },
        })
        .collect();
    let queries = Unimock::new((
        claim(0, 0),
        PublicationEventsMock::pending_publication_events
            .some_call(matching!(_, _, None))
            .returns(Ok(events)),
        PublicationsMock::publication
            .some_call(matching!(&PUBLICATION))
            .returns(Ok(Some(first))),
        PublicationsMock::publication
            .some_call(matching!(&SECOND))
            .returns(Ok(Some(second))),
        ProjectsMock::project
            .some_call(matching!(&PROJECT))
            .returns(Ok(Some(project()))),
        ProjectsMock::project
            .some_call(matching!(&SECOND_PROJECT))
            .returns(Ok(Some(healthy))),
        organization_query(),
        check_fixture::reference(PUBLICATION, PROJECT, 1),
        check_fixture::reference(SECOND, SECOND_PROJECT, 1),
        PublicationEventsMock::retry_publication_event
            .next_call(matching!(_, 1, 1, _, &None))
            .returns(Ok(true)),
        PublicationEventsMock::deliver_publication_event
            .next_call(matching!((id, version, _) if *id == SECOND.0 && *version == 1))
            .returns(Ok(true)),
    ));
    let github = Unimock::new((
        CheckRunsMock::upsert
            .each_call(matching!((check,) if check.repository == "mokly-ai/mokly-cloud"))
            .answers(&|_, _| {
                Err(CheckError::Http {
                    status: 422,
                    rate_limited: false,
                })
            }),
        CheckRunsMock::upsert
            .some_call(matching!((check,) if check.repository == "another-tenant/healthy"))
            .returns(Ok(())),
    ));
    let worker = PublicationChecks {
        transactions: transactions(queries),
        files: check_fixture::files(2),
        github: Arc::new(github),
        runtime: clock(),
        locations: locations(),
    };
    assert_eq!(worker.run_batch(None).unwrap(), 1);
}

#[test]
fn retries_back_off_and_fifth_failure_dead_letters() {
    for attempts in 0..5 {
        let queries = Unimock::new((
            claim(attempts, attempts),
            PublicationEventsMock::pending_publication_events
                .next_call(matching!(_, 100, None))
                .returns(Ok(vec![PendingEvent {
                    attempts,
                    permanent_failures: attempts,
                    event: PublicationEvent {
                        id: PUBLICATION.0,
                        publication_id: PUBLICATION,
                        kind: EventKind::Ready,
                        created_at: now(),
                    },
                }])),
            PublicationsMock::publication
                .next_call(matching!(_))
                .returns(Ok(Some(publication()))),
            ProjectsMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(project()))),
            organization_query(),
            check_fixture::reference(PUBLICATION, PROJECT, 1),
            PublicationEventsMock::retry_publication_event
                .next_call(matching!(_, _, _, _, _))
                .answers_arc(Arc::new(move |_, id, observed, permanent, due, dead| {
                    assert_eq!(id, PUBLICATION.0);
                    assert_eq!(observed, attempts + 1);
                    assert_eq!(permanent, attempts + 1);
                    assert_eq!(
                        due,
                        now() + Duration::seconds([60, 120, 240, 480, 960][attempts as usize])
                    );
                    assert_eq!(dead, (attempts == 4).then_some(now()));
                    Ok(true)
                })),
        ));
        let worker = PublicationChecks {
            transactions: transactions(queries),
            files: check_fixture::files(1),
            github: Arc::new(Unimock::new(
                CheckRunsMock::upsert
                    .next_call(matching!(_))
                    .returns(Err(CheckError::Http {
                        status: 422,
                        rate_limited: false,
                    })),
            )),
            runtime: clock(),
            locations: locations(),
        };
        assert_eq!(worker.run_batch(None).unwrap(), 0);
    }
}
