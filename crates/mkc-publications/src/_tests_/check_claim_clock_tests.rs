//! Claim each row with a fresh clock reading after the preceding delivery finishes.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::RuntimeMock;
use mkc_github_interface::check::CheckRunsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::publication_event::{
    EventClaim, EventKind, PendingEvent, PublicationEvent, PublicationEventsMock,
};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::check_worker::{ChecksWorker, PublicationChecks};

use super::check_fixture;
use super::support::{
    PROJECT, PUBLICATION, locations, now, organization_query, project, publication, transactions,
};

const FIRST: Uuid = Uuid::from_u128(7);
const SECOND: Uuid = Uuid::from_u128(8);

#[test]
fn each_row_gets_five_minutes_from_its_own_delivery_time() {
    let events = [FIRST, SECOND]
        .into_iter()
        .map(|id| PendingEvent {
            event: PublicationEvent {
                id,
                publication_id: PUBLICATION,
                kind: EventKind::Ready,
                created_at: now(),
            },
            attempts: 0,
            permanent_failures: 0,
        })
        .collect();
    let queries = Unimock::new((
        PublicationEventsMock::pending_publication_events.next_call(matching!(_, 100, None)).returns(Ok(events)),
        PublicationEventsMock::claim_publication_event
            .next_call(matching!((id, version, at, until) if *id == FIRST && *version == 0
                && *at == now() + Duration::seconds(1) && *until == *at + Duration::minutes(5)))
            .returns(Ok(Some(EventClaim { attempts: 1, permanent_failures: 0 }))),
        PublicationEventsMock::deliver_publication_event
            .next_call(matching!((id, version, at) if *id == FIRST && *version == 1 && *at == now() + Duration::seconds(2)))
            .returns(Ok(true)),
        PublicationEventsMock::claim_publication_event
            .next_call(matching!((id, version, at, until) if *id == SECOND && *version == 0
                && *at == now() + Duration::seconds(3) && *until == *at + Duration::minutes(5)))
            .returns(Ok(Some(EventClaim { attempts: 1, permanent_failures: 0 }))),
        PublicationEventsMock::deliver_publication_event
            .next_call(matching!((id, version, at) if *id == SECOND && *version == 1 && *at == now() + Duration::seconds(4)))
            .returns(Ok(true)),
        PublicationsMock::publication.each_call(matching!(_)).answers(&|_, _| Ok(Some(publication()))),
        ProjectsMock::project.each_call(matching!(_)).answers(&|_, _| Ok(Some(project()))),
        organization_query(),
        check_fixture::reference(PUBLICATION, PROJECT, 2),
    ));
    let worker: &dyn ChecksWorker = &PublicationChecks {
        transactions: transactions(queries),
        files: check_fixture::files(2),
        github: Arc::new(Unimock::new(
            CheckRunsMock::upsert
                .each_call(matching!(_))
                .answers(&|_, _| Ok(())),
        )),
        runtime: Arc::new(Unimock::new((
            RuntimeMock::now.next_call(matching!()).returns(now()),
            RuntimeMock::now
                .next_call(matching!())
                .returns(now() + Duration::seconds(1)),
            RuntimeMock::now
                .next_call(matching!())
                .returns(now() + Duration::seconds(2)),
            RuntimeMock::now
                .next_call(matching!())
                .returns(now() + Duration::seconds(3)),
            RuntimeMock::now
                .next_call(matching!())
                .returns(now() + Duration::seconds(4)),
        ))),
        locations: locations(),
    };
    assert_eq!(worker.run_batch(None).unwrap(), 2);
}
