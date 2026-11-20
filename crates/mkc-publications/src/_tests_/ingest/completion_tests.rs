//! Completion resolves the attempt's state before checking or publishing its blobs.

use std::sync::Arc;

use chrono::Duration;
use mkc_domain::blob::BlobHash;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationState, PublicationsMock,
};
use mkc_store_interface::publication_event::PublicationEventsMock;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::ingest::{Ingest, Ingested};

use super::{authorization, exchange};
use crate::tests::support::{PROJECT, PUBLICATION, now, publication};

const WINNER: PublicationId = PublicationId(Uuid::from_u128(77));

fn attempt(state: PublicationState, failure: Option<PublicationFailure>) -> Publication {
    Publication {
        state,
        failure,
        changes: None,
        ..publication()
    }
}

fn winner() -> Publication {
    Publication {
        id: WINNER,
        ..publication()
    }
}

fn own(attempt: Publication) -> impl Clause {
    PublicationsMock::publication
        .next_call(matching!(&PUBLICATION))
        .returns(Ok(Some(attempt)))
}

fn reads(attempt: Publication, winner: Option<Publication>) -> impl Clause {
    (
        own(attempt),
        PublicationsMock::publication_by_identity
            .each_call(matching!(&PROJECT, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| Ok(winner.clone()))),
    )
}

fn complete(queries: Unimock) -> Result<Ingested> {
    exchange(queries, Unimock::new(()), false).complete(authorization(), PUBLICATION)
}

#[test]
fn an_attempt_that_became_ready_answers_201_on_every_retry() {
    for state in [PublicationState::Ready, PublicationState::Expired] {
        let done = complete(Unimock::new(own(attempt(state, None)))).unwrap();
        assert!(!done.replay);
        assert_eq!(done.publication.id, PUBLICATION);
    }
}

#[test]
fn a_superseded_attempt_answers_200_while_a_publication_is_ready() {
    let superseded = attempt(
        PublicationState::Failed,
        Some(PublicationFailure::Superseded),
    );
    let done = complete(Unimock::new(reads(superseded.clone(), Some(winner())))).unwrap();
    assert!(done.replay);
    assert_eq!(done.publication.id, WINNER);
    assert!(matches!(
        complete(Unimock::new(reads(superseded, None))),
        Err(Error::Expired)
    ));
}

#[test]
fn a_validating_attempt_is_superseded_before_its_blobs_are_checked() {
    let ingest = exchange(
        Unimock::new((
            reads(attempt(PublicationState::Validating, None), Some(winner())),
            PublicationsMock::fail_publication
                .next_call(matching!(&PUBLICATION, PublicationFailure::Superseded))
                .returns(Ok(true)),
            BlobsMock::delete_publication_files
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(())),
            PublicationEventsMock::insert_publication_event
                .next_call(matching!(_))
                .returns(Ok(())),
        )),
        Unimock::new(()),
        true,
    );
    let done = ingest.complete(authorization(), PUBLICATION).unwrap();
    assert!(done.replay);
    assert_eq!(done.publication.id, WINNER);
}

#[test]
fn an_upload_closed_by_an_overlapping_completion_keeps_its_files() {
    let ingest = exchange(
        Unimock::new((
            reads(attempt(PublicationState::Validating, None), Some(winner())),
            PublicationsMock::fail_publication
                .next_call(matching!(&PUBLICATION, PublicationFailure::Superseded))
                .returns(Ok(false)),
        )),
        Unimock::new(()),
        true,
    );
    let done = ingest.complete(authorization(), PUBLICATION).unwrap();
    assert!(done.replay);
    assert_eq!(done.publication.id, WINNER);
}

#[test]
fn closed_and_late_attempts_without_a_ready_publication_have_expired() {
    for closed in [
        attempt(PublicationState::Failed, Some(PublicationFailure::Internal)),
        attempt(PublicationState::Uploading, None),
    ] {
        assert!(matches!(
            complete(Unimock::new(own(closed))),
            Err(Error::Expired)
        ));
    }
    let late = Publication {
        deadline: now() - Duration::seconds(1),
        ..attempt(PublicationState::Validating, None)
    };
    assert!(matches!(
        complete(Unimock::new(reads(late, None))),
        Err(Error::Expired)
    ));
}

#[test]
fn unknown_and_foreign_attempts_are_not_found() {
    assert!(matches!(
        complete(Unimock::new(
            PublicationsMock::publication
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(None)),
        )),
        Err(Error::NotFound)
    ));
    let foreign = Publication {
        project_id: mkc_domain::ids::ProjectId(Uuid::from_u128(98)),
        ..attempt(PublicationState::Validating, None)
    };
    assert!(matches!(
        complete(Unimock::new(
            PublicationsMock::publication
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(Some(foreign))),
        )),
        Err(Error::NotFound)
    ));
}

#[test]
fn blobs_still_to_send_answer_incomplete() {
    assert!(matches!(
        complete(Unimock::new((
            reads(attempt(PublicationState::Validating, None), None),
            BlobsMock::pending_publication_blobs
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(vec![BlobHash::digest(b"missing")])),
        ))),
        Err(Error::Incomplete)
    ));
}
