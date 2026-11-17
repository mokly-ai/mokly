//! Blob PUTs resolve the attempt's reservation and store only verified bytes.

use std::sync::Arc;

use bytes::Bytes;
use chrono::Duration;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::ProjectId;
use mkc_store_interface::blob::{Blob, BlobsMock};
use mkc_store_interface::publication::{Publication, PublicationState, PublicationsMock};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::blob_writer::BlobWriterMock;
use crate::error::{Error, Result};
use crate::ingest::{BlobTarget, Ingest};

use super::{authorization, exchange, writing};
use crate::tests::support::{PROJECT, PUBLICATION, now, publication};

const BODY: &[u8] = b"<p>catalogue</p>";

fn attempt(state: PublicationState) -> Publication {
    Publication {
        state,
        ..publication()
    }
}

fn reserved(stored: bool) -> Blob {
    Blob {
        project_id: PROJECT,
        key: BlobKey {
            hash: BlobHash::digest(BODY),
            incarnation: Uuid::from_u128(7),
        },
        size: BODY.len() as i64,
        content_type: "text/html".into(),
        ref_count: 1,
        deleting: false,
        unreferenced_at: None,
        stored_at: stored.then(now),
    }
}

/// Resolve the body's target; the blob lookup is mocked only when the attempt is open.
fn target(attempt: Option<Publication>, blob: Option<Option<Blob>>) -> Result<BlobTarget> {
    target_hash(attempt, blob, Some(&BlobHash::digest(BODY)))
}

fn target_hash(
    attempt: Option<Publication>,
    blob: Option<Option<Blob>>,
    hash: Option<&BlobHash>,
) -> Result<BlobTarget> {
    let read = PublicationsMock::publication
        .next_call(matching!(&PUBLICATION))
        .returns(Ok(attempt));
    let queries = match blob {
        Some(blob) => Unimock::new((
            read,
            BlobsMock::publication_blob
                .next_call(matching!(&PUBLICATION, _))
                .answers_arc(Arc::new(move |_, _, _| Ok(blob.clone()))),
        )),
        None => Unimock::new(read),
    };
    exchange(queries, Unimock::new(()), false).blob_target(&authorization(), PUBLICATION, hash)
}

#[test]
fn a_reserved_blob_resolves_its_size_and_durability() {
    let target = target(
        Some(attempt(PublicationState::Validating)),
        Some(Some(reserved(true))),
    )
    .unwrap();
    assert_eq!(target.size, BODY.len() as u64);
    assert!(target.durable);
    assert_eq!(target.deadline, publication().deadline);
}

#[test]
fn unknown_foreign_closed_late_and_unreserved_requests_are_refused() {
    assert!(matches!(target(None, None), Err(Error::NotFound)));
    let foreign = Publication {
        project_id: ProjectId(Uuid::from_u128(99)),
        ..attempt(PublicationState::Validating)
    };
    assert!(matches!(target(Some(foreign), None), Err(Error::NotFound)));
    for state in [
        PublicationState::Ready,
        PublicationState::Failed,
        PublicationState::Uploading,
    ] {
        assert!(matches!(
            target(Some(attempt(state)), None),
            Err(Error::Expired)
        ));
    }
    let late = Publication {
        deadline: now() - Duration::seconds(1),
        ..attempt(PublicationState::Validating)
    };
    assert!(matches!(target(Some(late), None), Err(Error::Expired)));
    assert!(matches!(
        target(Some(attempt(PublicationState::Validating)), Some(None)),
        Err(Error::UnknownBlob)
    ));
}

#[test]
fn a_path_segment_that_is_not_a_digest_is_checked_after_the_attempt() {
    assert!(matches!(
        target_hash(None, None, None),
        Err(Error::NotFound)
    ));
    assert!(matches!(
        target_hash(Some(attempt(PublicationState::Failed)), None, None),
        Err(Error::Expired)
    ));
    assert!(matches!(
        target_hash(Some(attempt(PublicationState::Validating)), None, None),
        Err(Error::UnknownBlob)
    ));
}

#[test]
fn only_bytes_matching_the_reservation_are_written() {
    let target = BlobTarget {
        project: PROJECT,
        key: reserved(false).key,
        size: BODY.len() as u64,
        durable: false,
        deadline: publication().deadline,
    };
    let rejecting = writing(Unimock::new(()));
    for body in [b"<p>catalogue</p>!".as_slice(), b"<p>catalogu3</p>"] {
        assert!(matches!(
            rejecting.store_blob(&target, Bytes::copy_from_slice(body)),
            Err(Error::BlobMismatch)
        ));
    }
    let key = target.key.clone();
    let writer = writing(Unimock::new(
        BlobWriterMock::write
            .next_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, pending, report| {
                assert_eq!(pending.len(), 1);
                assert_eq!(*pending[0].key, key);
                report.written = 1;
                Ok(())
            })),
    ));
    assert!(writer.store_blob(&target, Bytes::from_static(BODY)).is_ok());
}

#[test]
fn zero_byte_blobs_are_valid() {
    let empty = BlobTarget {
        project: PROJECT,
        key: BlobKey {
            hash: BlobHash::digest(b""),
            incarnation: Uuid::from_u128(8),
        },
        size: 0,
        durable: false,
        deadline: publication().deadline,
    };
    let writer = writing(Unimock::new(
        BlobWriterMock::write
            .next_call(matching!(_, _, _))
            .returns(Ok(())),
    ));
    assert!(writer.store_blob(&empty, Bytes::new()).is_ok());
}
