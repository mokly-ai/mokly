//! Provider outages must remain retryable beyond the permanent-failure budget.

use std::sync::Arc;

use chrono::Duration;
use mkc_github_interface::check::{CheckRunsMock, Error as CheckError};
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::publication_event::{
    EventKind, PendingEvent, PublicationEvent, PublicationEventsMock,
};
use unimock::{MockFn, Unimock, matching};

use crate::check_worker::{ChecksWorker, PublicationChecks};
use crate::error::Error;

use super::check_fixture;
use super::support::{
    PROJECT, PUBLICATION, claim, clock, locations, now, organization_query, project, publication,
    transactions,
};

#[test]
fn scoped_batch_passes_the_project_to_the_outbox_query() {
    let queries = Unimock::new(
        PublicationEventsMock::pending_publication_events
            .next_call(matching!(_, 100, _))
            .answers(&|_, _, _, scope| {
                assert_eq!(scope, Some(PROJECT));
                Ok(vec![])
            }),
    );
    let worker: &dyn ChecksWorker = &PublicationChecks {
        transactions: transactions(queries),
        files: Arc::new(Unimock::new(())),
        github: Arc::new(Unimock::new(())),
        runtime: clock(),
        locations: locations(),
    };
    assert_eq!(worker.run_batch(Some(PROJECT)).unwrap(), 0);
}

#[test]
fn transient_outages_never_exhaust_the_permanent_budget_and_cap_backoff() {
    for (attempts, permanent_failures) in [(0, 0), (4, 4), (6, 4), (20, 0), (100, 4)] {
        let queries = Unimock::new((
            claim(attempts, permanent_failures),
            PublicationEventsMock::pending_publication_events
                .next_call(matching!(_, _, None))
                .returns(Ok(vec![PendingEvent {
                    attempts,
                    permanent_failures,
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
                .answers_arc(Arc::new(move |_, _, observed, permanent, due, dead| {
                    assert_eq!(observed, attempts + 1);
                    assert_eq!(permanent, permanent_failures);
                    assert!(dead.is_none(), "transient outage must never dead-letter");
                    assert_eq!(
                        due,
                        now() + Duration::seconds((60_i64 << attempts.min(6)).min(3600))
                    );
                    Ok(true)
                })),
        ));
        let worker: &dyn ChecksWorker = &PublicationChecks {
            transactions: transactions(queries),
            files: check_fixture::files(1),
            github: Arc::new(Unimock::new(
                CheckRunsMock::upsert
                    .next_call(matching!(_))
                    .returns(Err(CheckError::internal(Error::Unavailable))),
            )),
            runtime: clock(),
            locations: locations(),
        };
        assert_eq!(worker.run_batch(None).unwrap(), 0);
    }
}
