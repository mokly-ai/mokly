//! A missing stored index fails only an upload still being published;
//! a failed read or decode fails at once.

use std::sync::Arc;

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::PublicationId;
use mkc_file_store_interface::error;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_store_interface::blob::{BlobsMock, PublicationFile};
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationState, PublicationsMock,
};
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::ingest::{Ingest, Ingested, PublicationIngest};
use crate::stored_index::BoundedStoredIndexReader;
use crate::tests::support::{PROJECT, PUBLICATION, publication};

use super::{authorization, exchange, service_with_files};

const WINNER: PublicationId = PublicationId(Uuid::from_u128(77));

/// The upload as a row: unfinished with a stored comparison unless closed.
fn upload(state: PublicationState, failure: Option<PublicationFailure>) -> Publication {
    let mut row = Publication {
        state,
        failure,
        changes: None,
        ..publication()
    };
    if let Some(metadata) = &mut row.metadata {
        metadata.base_ref = Some("main".into());
        metadata.base_sha = Some("c".repeat(40));
    }
    row
}

fn own(row: Publication) -> impl Clause {
    PublicationsMock::publication
        .next_call(matching!(&PUBLICATION))
        .returns(Ok(Some(row)))
}

fn ready_for_identity(ready: Option<Publication>) -> impl Clause {
    PublicationsMock::publication_by_identity
        .next_call(matching!(&PROJECT, _, _))
        .returns(Ok(ready))
}

/// The fast check finds the upload unfinished with every blob durable.
fn first_reads() -> impl Clause {
    first_reads_for(upload(PublicationState::Validating, None))
}

fn first_reads_for(attempt: Publication) -> impl Clause {
    (
        own(attempt),
        ready_for_identity(None),
        BlobsMock::pending_publication_blobs
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(Vec::new())),
    )
}

fn index_reference(reference: Option<PublicationFile>) -> impl Clause {
    BlobsMock::publication_file
        .next_call(matching!((&PUBLICATION, path) if *path == INDEX_PATH))
        .returns(Ok(reference))
}

fn stored_reference() -> PublicationFile {
    PublicationFile {
        publication_id: PUBLICATION,
        project_id: PROJECT,
        path: INDEX_PATH.into(),
        key: BlobKey {
            hash: BlobHash::digest(b"index"),
            incarnation: Uuid::from_u128(10),
        },
        content_type: "application/json".into(),
        size: 6,
    }
}

fn complete(queries: impl Clause, files: Unimock) -> Result<Ingested> {
    service_with_files(
        Unimock::new(queries),
        Unimock::new(()),
        Unimock::new(()),
        files,
    )
    .complete(authorization(), PUBLICATION)
}

/// Allow only the reads before finish; IDs and policy calls remain unexpected.
fn complete_before_ready(queries: impl Clause, files: Unimock) -> Result<Ingested> {
    PublicationIngest {
        files: Arc::new(BoundedStoredIndexReader::new(Arc::new(files))),
        ..exchange(Unimock::new(queries), Unimock::new(()), false)
    }
    .complete(authorization(), PUBLICATION)
}

#[test]
fn a_missing_index_reference_fails_an_upload_the_ready_transaction_still_publishes() {
    for comparison in [true, false] {
        let mut attempt = upload(PublicationState::Validating, None);
        if !comparison {
            let metadata = attempt.metadata.as_mut().unwrap();
            metadata.base_ref = None;
            metadata.base_sha = None;
        }
        let result = complete(
            (
                first_reads_for(attempt.clone()),
                index_reference(None),
                own(attempt),
                ready_for_identity(None),
            ),
            Unimock::new(()),
        );
        assert!(
            matches!(result, Err(Error::Internal(_))),
            "comparison: {comparison}"
        );
    }
}

#[test]
fn missing_index_bytes_fail_an_upload_the_ready_transaction_still_publishes() {
    let result = complete(
        (
            first_reads(),
            index_reference(Some(stored_reference())),
            own(upload(PublicationState::Validating, None)),
            ready_for_identity(None),
        ),
        Unimock::new(FileStoreMock::get.next_call(matching!(_)).returns(Ok(None))),
    );
    assert!(matches!(result, Err(Error::Internal(_))));
}

#[test]
fn a_failed_stored_index_read_fails_before_the_ready_transaction() {
    let result = complete_before_ready(
        (first_reads(), index_reference(Some(stored_reference()))),
        Unimock::new(
            FileStoreMock::get
                .next_call(matching!(_))
                .returns(Err(error::Error::internal(Error::Unavailable))),
        ),
    );
    assert!(matches!(result, Err(Error::Internal(_))));
}

#[test]
fn an_invalid_stored_index_fails_before_the_ready_transaction() {
    let result = complete_before_ready(
        (first_reads(), index_reference(Some(stored_reference()))),
        Unimock::new(
            FileStoreMock::get
                .next_call(matching!(_))
                .returns(Ok(Some(b"not JSON".to_vec()))),
        ),
    );
    assert!(matches!(result, Err(Error::Internal(_))));
}

#[test]
fn an_index_released_by_a_concurrent_supersede_answers_with_the_winner() {
    let done = complete(
        (
            first_reads(),
            index_reference(None),
            own(upload(
                PublicationState::Failed,
                Some(PublicationFailure::Superseded),
            )),
            ready_for_identity(Some(Publication {
                id: WINNER,
                ..publication()
            })),
        ),
        Unimock::new(()),
    )
    .unwrap();
    assert_eq!((done.publication.id, done.replay), (WINNER, true));
}

#[test]
fn a_failed_index_reference_query_fails_before_the_ready_transaction() {
    let result = complete_before_ready(
        (
            first_reads(),
            BlobsMock::publication_file
                .next_call(matching!((_, path) if *path == INDEX_PATH))
                .returns(Err(mkc_store_interface::error::Error::internal(
                    Error::Unavailable,
                ))),
        ),
        Unimock::new(()),
    );
    assert!(matches!(result, Err(Error::Internal(_))));
}
