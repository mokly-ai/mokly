//! The ready transaction decides from the upload's own row before it writes.

use std::sync::Arc;

use mkc_auth::runtime::hash;
use mkc_domain::blob::BlobHash;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationState, PublicationsMock,
};
use mkc_store_interface::publication_event::PublicationEventsMock;
use mkc_store_interface::token::TokensMock;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::completion_outcome::StoredIndex;
use crate::error::{Error, Result};
use crate::ingest::{Ingested, PublicationIngest, UploadAuthorization};
use crate::policy::AccessPolicyMock;
use crate::reservation::Completion;
use crate::upload_authorization::Credential;

use super::support::{
    PROJECT, PUBLICATION, bearer, project, publication, runtime, token, transactions,
};

const OTHER: PublicationId = PublicationId(Uuid::from_u128(77));

fn upload(state: PublicationState, failure: Option<PublicationFailure>) -> Publication {
    Publication {
        state,
        failure,
        changes: None,
        ..publication()
    }
}

/// The ready transaction with these store calls behind one authorized token.
fn finish(queries: impl Clause, attempt: &Publication) -> Result<Ingested> {
    let ingest = PublicationIngest {
        transactions: transactions(Unimock::new(queries)),
        runtime: runtime(),
        policy: Arc::new(Unimock::new(
            AccessPolicyMock::token
                .next_call(matching!(_, _, _))
                .returns(Ok((project(), token()))),
        )),
        validator: Arc::new(Unimock::new(())),
        writer: Arc::new(Unimock::new(())),
        files: Arc::new(Unimock::new(())),
    };
    let authorization = UploadAuthorization {
        project: PROJECT,
        credential: Credential::Project(hash(&bearer())),
        build_id: None,
        organization_slug: super::support::organization_slug(),
        project_slug: super::support::project_slug(),
    };
    ingest.finish(
        &authorization,
        attempt,
        &publication().metadata.unwrap(),
        &StoredIndex::Loaded(Box::new(super::index_fixture::load(
            super::index_fixture::RELEASED_BYTES.to_vec(),
        ))),
    )
}

fn own_row(row: Option<Publication>) -> impl Clause {
    PublicationsMock::publication
        .next_call(matching!(&PUBLICATION))
        .returns(Ok(row))
}

fn ready_for_identity(ready: Option<Publication>) -> impl Clause {
    PublicationsMock::publication_by_identity
        .next_call(matching!(&PROJECT, _, "mokly.config.json"))
        .returns(Ok(ready))
}

#[test]
fn completion_rejects_reaped_attempts_before_persisting_observations() {
    let reaped = upload(PublicationState::Failed, Some(PublicationFailure::Expired));
    let attempt = upload(PublicationState::Validating, None);
    for retained in [None, Some(reaped)] {
        assert!(matches!(
            finish(own_row(retained), &attempt),
            Err(Error::Expired)
        ));
    }
}

#[test]
fn completion_refuses_to_publish_pending_blob_references() {
    let attempt = upload(PublicationState::Validating, None);
    let queries = (
        own_row(Some(attempt.clone())),
        ready_for_identity(None),
        BlobsMock::pending_publication_blobs
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(vec![BlobHash::digest(b"pending")])),
    );
    assert!(matches!(finish(queries, &attempt), Err(Error::Internal(_))));
}

#[test]
fn a_repeated_completion_answers_with_the_upload_it_published_and_writes_nothing() {
    let attempt = upload(PublicationState::Validating, None);
    for state in [PublicationState::Ready, PublicationState::Expired] {
        let done = finish(own_row(Some(upload(state, None))), &attempt).unwrap();
        assert_eq!(
            (done.publication.id, done.publication.state, done.replay),
            (PUBLICATION, state, false)
        );
    }
}

/// The upload is unfinished, a different publication is ready for its identity
/// and closing the upload reports whether this transaction closed it.
fn superseded_by_other(attempt: &Publication, closed_here: bool) -> impl Clause {
    (
        own_row(Some(attempt.clone())),
        ready_for_identity(Some(Publication {
            id: OTHER,
            ..publication()
        })),
        PublicationsMock::fail_publication
            .next_call(matching!(&PUBLICATION, PublicationFailure::Superseded))
            .returns(Ok(closed_here)),
    )
}

fn touch_token() -> impl Clause {
    TokensMock::save_token
        .next_call(matching!(_))
        .returns(Ok(()))
}

#[test]
fn a_different_ready_publication_closes_the_upload_and_releases_its_files_once() {
    let attempt = upload(PublicationState::Validating, None);
    let release = (
        BlobsMock::delete_publication_files
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(())),
        PublicationEventsMock::insert_publication_event
            .next_call(matching!(_))
            .returns(Ok(())),
    );
    let closed = finish(
        (superseded_by_other(&attempt, true), release, touch_token()),
        &attempt,
    )
    .unwrap();
    let already_closed = finish(
        (superseded_by_other(&attempt, false), touch_token()),
        &attempt,
    )
    .unwrap();
    for done in [closed, already_closed] {
        assert_eq!((done.publication.id, done.replay), (OTHER, true));
    }
}

#[test]
fn a_superseded_upload_answers_with_the_ready_publication_and_writes_nothing() {
    let attempt = upload(PublicationState::Validating, None);
    let superseded = upload(
        PublicationState::Failed,
        Some(PublicationFailure::Superseded),
    );
    let other = Publication {
        id: OTHER,
        ..publication()
    };
    let done = finish(
        (own_row(Some(superseded)), ready_for_identity(Some(other))),
        &attempt,
    )
    .unwrap();
    assert_eq!((done.publication.id, done.replay), (OTHER, true));
}
