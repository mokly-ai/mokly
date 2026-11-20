//! Cleanup keeps ready publications and rechecks attempt state and age.

use chrono::Duration;
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::publication::{PublicationFailure, PublicationState, PublicationsMock};
use mkc_store_interface::publication_event::{EventKind, PublicationEventsMock};
use unimock::{MockFn, Unimock, matching};

use crate::retention::{PublicationRetention, RetentionWorker};

use super::support::{PUBLICATION, now, publication, runtime, transactions};

#[test]
fn every_ready_publication_is_preserved_at_the_retention_cutoff() {
    for selected_state in [PublicationState::Ready, PublicationState::Validating] {
        let mut ready = publication();
        ready.created_at = now() - Duration::days(365);
        ready.deadline = now();
        let mut candidate = ready.clone();
        candidate.state = selected_state;
        if selected_state == PublicationState::Validating {
            candidate.changes = None;
        }
        let worker = PublicationRetention {
            transactions: transactions(Unimock::new((
                PublicationsMock::publication_candidates
                    .some_call(matching!(_, _, None, 100))
                    .returns(Ok(vec![candidate])),
                PublicationsMock::publication
                    .some_call(matching!(&PUBLICATION))
                    .returns(Ok(Some(ready))),
                PublicationEventsMock::prune_catalogue_grants
                    .some_call(matching!(_))
                    .returns(Ok(())),
            ))),
            runtime: runtime(),
        };
        let report = worker.run_batch(None).unwrap();
        assert_eq!(
            (report.abandoned, report.pruned),
            (0, 0),
            "{selected_state:?}"
        );
    }
}

#[test]
fn failed_attempt_metadata_is_pruned_at_the_inclusive_thirty_day_cutoff() {
    for age in [29, 30, 31] {
        let mut candidate = publication();
        candidate.state = PublicationState::Failed;
        candidate.failure = Some(PublicationFailure::Internal);
        candidate.changes = None;
        candidate.created_at = now() - Duration::days(age);
        let common = (
            PublicationsMock::publication_candidates
                .some_call(matching!(_, _, _, _))
                .returns(Ok(vec![candidate.clone()])),
            PublicationsMock::publication
                .some_call(matching!(_))
                .returns(Ok(Some(candidate))),
            PublicationEventsMock::prune_catalogue_grants
                .some_call(matching!(_))
                .returns(Ok(())),
        );
        let queries = if age >= 30 {
            Unimock::new((
                common,
                PublicationsMock::delete_failed_publication
                    .some_call(matching!(&PUBLICATION, _))
                    .returns(Ok(true)),
            ))
        } else {
            Unimock::new(common)
        };
        let worker = PublicationRetention {
            transactions: transactions(queries),
            runtime: runtime(),
        };
        assert_eq!(
            worker.run_batch(None).unwrap().pruned,
            usize::from(age >= 30),
            "age {age}"
        );
    }
}

#[test]
fn abandoned_attempts_release_references_at_the_inclusive_deadline() {
    let mut candidate = publication();
    candidate.metadata = None;
    candidate.state = PublicationState::Uploading;
    candidate.deadline = now();
    let worker = PublicationRetention {
        transactions: transactions(Unimock::new((
            PublicationsMock::publication_candidates
                .next_call(matching!(_, _, _, _))
                .returns(Ok(vec![candidate.clone()])),
            PublicationsMock::publication
                .next_call(matching!(_))
                .returns(Ok(Some(candidate))),
            PublicationsMock::fail_publication
                .next_call(matching!(&PUBLICATION, PublicationFailure::Expired))
                .returns(Ok(true)),
            BlobsMock::delete_publication_files
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(())),
            PublicationEventsMock::insert_publication_event
                .next_call(matching!((event,) if event.kind == EventKind::Failed))
                .returns(Ok(())),
            PublicationEventsMock::prune_catalogue_grants
                .next_call(matching!(_))
                .returns(Ok(())),
        ))),
        runtime: runtime(),
    };
    assert_eq!(worker.run_batch(None).unwrap().abandoned, 1);
}
