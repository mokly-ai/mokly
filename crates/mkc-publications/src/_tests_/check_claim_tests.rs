//! Competing delivery workers must claim an event before touching the provider.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Barrier};
use std::thread;

use chrono::Duration;
use mkc_github_interface::check::{CheckRunsMock, Error};
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::publication_event::{
    EventClaim, EventKind, PendingEvent, PublicationEvent, PublicationEventsMock,
};
use unimock::{MockFn, Unimock, matching};

use crate::check_worker::{ChecksWorker, PublicationChecks};

use super::check_fixture;
use super::support::{
    PROJECT, PUBLICATION, claim, clock, locations, now, organization_query, project, publication,
    transactions,
};

fn event() -> PendingEvent {
    PendingEvent {
        event: PublicationEvent {
            id: PUBLICATION.0,
            publication_id: PUBLICATION,
            kind: EventKind::Ready,
            created_at: now(),
        },
        attempts: 0,
        permanent_failures: 0,
    }
}

#[test]
fn overlapping_batches_deliver_one_event_once() {
    let reads = Arc::new(Barrier::new(2));
    let calls = Arc::new(AtomicUsize::new(0));
    let counted = calls.clone();
    let claimed = AtomicBool::new(false);
    let queries = Unimock::new((
        PublicationEventsMock::pending_publication_events
            .each_call(matching!(_, 100, None))
            .answers_arc(Arc::new(move |_, _, _, _| {
                reads.wait();
                Ok(vec![event()])
            }))
            .n_times(2),
        PublicationEventsMock::claim_publication_event
            .each_call(matching!(_, 0, _, _))
            .answers_arc(Arc::new(move |_, _, _, at, until| {
                assert_eq!(until, at + Duration::minutes(5));
                Ok(claimed
                    .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                    .ok()
                    .map(|_| EventClaim {
                        attempts: 1,
                        permanent_failures: 0,
                    }))
            }))
            .n_times(2),
        PublicationsMock::publication
            .each_call(matching!(&PUBLICATION))
            .answers(&|_, _| Ok(Some(publication()))),
        ProjectsMock::project
            .each_call(matching!(&PROJECT))
            .answers(&|_, _| Ok(Some(project()))),
        organization_query(),
        check_fixture::reference(PUBLICATION, PROJECT, 1),
        PublicationEventsMock::deliver_publication_event
            .each_call(matching!(_, 1, _))
            .answers(&|_, _, _, _| Ok(true)),
    ));
    let worker: Arc<dyn ChecksWorker> = Arc::new(PublicationChecks {
        transactions: transactions(queries),
        files: check_fixture::files(1),
        github: Arc::new(Unimock::new(
            CheckRunsMock::upsert
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    counted.fetch_add(1, Ordering::SeqCst);
                    Ok(())
                })),
        )),
        runtime: clock(),
        locations: locations(),
    });
    let other = worker.clone();
    let first = thread::spawn(move || other.run_batch(None).unwrap());
    let second = worker.run_batch(None).unwrap();
    let first = first.join().unwrap();
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(first + second, 1);
}

#[test]
fn lost_claim_skips_all_publication_file_provider_and_outcome_work() {
    let queries = Unimock::new((
        PublicationEventsMock::pending_publication_events
            .next_call(matching!(_, 100, None))
            .returns(Ok(vec![event()])),
        PublicationEventsMock::claim_publication_event
            .next_call(matching!(_, 0, _, _))
            .returns(Ok(None)),
    ));
    let worker: &dyn ChecksWorker = &PublicationChecks {
        transactions: transactions(queries),
        files: Arc::new(Unimock::new(())),
        github: Arc::new(Unimock::new(())),
        runtime: clock(),
        locations: locations(),
    };
    assert_eq!(worker.run_batch(None).unwrap(), 0);
}

#[test]
fn build_publication_events_are_delivered_without_reading_files_or_calling_github() {
    let mut publication = publication();
    publication.build_id = Some(PUBLICATION.0.into());
    let queries = Unimock::new((
        PublicationEventsMock::pending_publication_events
            .next_call(matching!(_, 100, None))
            .returns(Ok(vec![event()])),
        claim(0, 0),
        PublicationsMock::publication
            .next_call(matching!(_))
            .returns(Ok(Some(publication))),
        PublicationEventsMock::deliver_publication_event
            .next_call(matching!(_, 1, _))
            .returns(Ok(true)),
    ));
    let worker: &dyn ChecksWorker = &PublicationChecks {
        transactions: transactions(queries),
        files: Arc::new(Unimock::new(())),
        github: Arc::new(Unimock::new(())),
        runtime: clock(),
        locations: locations(),
    };
    assert_eq!(worker.run_batch(None).unwrap(), 1);
}

#[test]
fn both_outcomes_use_the_claimed_version_and_current_budget() {
    for (provider_ok, recorded) in [(true, true), (true, false), (false, true), (false, false)] {
        let common = (
            PublicationEventsMock::pending_publication_events
                .next_call(matching!(_, 100, None))
                .returns(Ok(vec![event()])),
            claim(0, 4),
            PublicationsMock::publication
                .next_call(matching!(_))
                .returns(Ok(Some(publication()))),
            ProjectsMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(project()))),
            organization_query(),
            check_fixture::reference(PUBLICATION, PROJECT, 1),
        );
        let queries = if provider_ok {
            Unimock::new((common, PublicationEventsMock::deliver_publication_event
                .next_call(matching!((id, version, at) if *id == PUBLICATION.0 && *version == 1 && *at == now()))
                .returns(Ok(recorded))))
        } else {
            Unimock::new((
                common,
                PublicationEventsMock::retry_publication_event
                    .next_call(
                        matching!((id, version, permanent, due, dead) if *id == PUBLICATION.0
                    && *version == 1 && *permanent == 5 && *due == now() + Duration::seconds(60)
                    && *dead == Some(now())),
                    )
                    .returns(Ok(recorded)),
            ))
        };
        let worker: &dyn ChecksWorker = &PublicationChecks {
            transactions: transactions(queries),
            files: check_fixture::files(1),
            github: Arc::new(Unimock::new(
                CheckRunsMock::upsert
                    .next_call(matching!(_))
                    .returns(if provider_ok {
                        Ok(())
                    } else {
                        Err(Error::Http {
                            status: 422,
                            rate_limited: false,
                        })
                    }),
            )),
            runtime: clock(),
            locations: locations(),
        };
        assert_eq!(
            worker.run_batch(None).unwrap(),
            usize::from(provider_ok && recorded)
        );
    }
}
