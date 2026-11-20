//! Completion decides from the upload's own row and never mistakes it for another.

use chrono::Duration;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationState, PublicationsMock,
};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::completion_outcome::{Outcome, decide, needs_ready_publication, resolve};
use crate::error::Error;

use super::support::{PROJECT, PUBLICATION, now, publication};

const OTHER: PublicationId = PublicationId(Uuid::from_u128(77));

fn upload(state: PublicationState, failure: Option<PublicationFailure>) -> Publication {
    Publication {
        state,
        failure,
        ..publication()
    }
}

/// The publication ready for the upload's identity, published by another upload.
fn other() -> Publication {
    Publication {
        id: OTHER,
        ..publication()
    }
}

/// The same upload as a ready row, as a later transaction can read it.
fn itself() -> Publication {
    upload(PublicationState::Ready, None)
}

#[test]
fn an_upload_that_became_ready_answers_with_itself_and_changes_nothing() {
    for state in [PublicationState::Ready, PublicationState::Expired] {
        for ready in [None, Some(itself())] {
            let outcome = decide(&upload(state, None), ready, now()).unwrap();
            let Outcome::Published(answer) = outcome else {
                panic!("{state:?} must answer with the upload: {outcome:?}");
            };
            assert_eq!((answer.id, answer.state), (PUBLICATION, state));
        }
    }
}

#[test]
fn a_ready_publication_with_the_upload_id_is_the_upload_itself() {
    for read in [
        upload(PublicationState::Validating, None),
        upload(
            PublicationState::Failed,
            Some(PublicationFailure::Superseded),
        ),
    ] {
        let outcome = decide(&read, Some(itself()), now()).unwrap();
        let Outcome::Published(answer) = outcome else {
            panic!("its own ready row must never supersede the upload: {outcome:?}");
        };
        assert_eq!(
            (answer.id, answer.state),
            (PUBLICATION, PublicationState::Ready)
        );
    }
}

#[test]
fn only_a_different_ready_publication_supersedes_an_unfinished_upload() {
    let outcome = decide(
        &upload(PublicationState::Validating, None),
        Some(other()),
        now(),
    );
    assert!(matches!(outcome, Ok(Outcome::Supersede(ready)) if ready.id == OTHER));
}

#[test]
fn a_superseded_upload_answers_with_the_ready_publication_until_none_is_ready() {
    let superseded = upload(
        PublicationState::Failed,
        Some(PublicationFailure::Superseded),
    );
    assert!(matches!(
        decide(&superseded, Some(other()), now()),
        Ok(Outcome::Replaced(ready)) if ready.id == OTHER
    ));
    assert!(matches!(
        decide(&superseded, None, now()),
        Err(Error::Expired)
    ));
}

#[test]
fn an_unfinished_upload_publishes_only_before_its_deadline() {
    let unfinished = upload(PublicationState::Validating, None);
    assert!(matches!(
        decide(
            &unfinished,
            None,
            unfinished.deadline - Duration::seconds(1)
        ),
        Ok(Outcome::Publish)
    ));
    assert!(matches!(
        decide(&unfinished, None, unfinished.deadline),
        Err(Error::Expired)
    ));
}

#[test]
fn uploads_closed_for_any_other_reason_have_expired() {
    for (state, failure) in [
        (PublicationState::Uploading, None),
        (PublicationState::Failed, Some(PublicationFailure::Internal)),
        (PublicationState::Failed, Some(PublicationFailure::Expired)),
    ] {
        assert!(matches!(
            decide(&upload(state, failure), Some(other()), now()),
            Err(Error::Expired)
        ));
    }
}

#[test]
fn only_unfinished_and_superseded_uploads_read_the_ready_publication() {
    for (state, failure, needed) in [
        (PublicationState::Validating, None, true),
        (
            PublicationState::Failed,
            Some(PublicationFailure::Superseded),
            true,
        ),
        (
            PublicationState::Failed,
            Some(PublicationFailure::InvalidBundle),
            false,
        ),
        (PublicationState::Uploading, None, false),
        (PublicationState::Ready, None, false),
        (PublicationState::Expired, None, false),
    ] {
        assert_eq!(
            needs_ready_publication(&upload(state, failure)),
            needed,
            "{state:?} {failure:?}"
        );
    }
}

#[test]
fn resolve_reads_the_ready_publication_only_when_the_decision_needs_it() {
    let mut reads = Unimock::new(
        PublicationsMock::publication_by_identity
            .next_call(matching!(&PROJECT, _, "mokly.config.json"))
            .returns(Ok(Some(other()))),
    );
    let outcome = resolve(
        &mut reads,
        &upload(PublicationState::Validating, None),
        now(),
    );
    assert!(matches!(outcome, Ok(Outcome::Supersede(ready)) if ready.id == OTHER));
    let mut untouched = Unimock::new(());
    let outcome = resolve(&mut untouched, &itself(), now());
    assert!(matches!(outcome, Ok(Outcome::Published(answer)) if answer.id == PUBLICATION));
}
