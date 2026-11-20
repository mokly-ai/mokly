//! Admission, contract rejection and storage-failure cleanup.

use std::collections::HashSet;
use std::io::Cursor;
use std::sync::Arc;

use mkc_domain::blob::BlobHash;
use mkc_mokly_contract::bundle::UploadValidatorMock;
use mkc_mokly_contract::error::{ArtifactKind, Error as ContractError, Limit, Rejection};
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::publication::{PublicationFailure, PublicationsMock};
use mkc_store_interface::publication_event::PublicationEventsMock;
use unimock::{MockFn, Unimock, matching};

use crate::blob_writer::BlobWriterMock;
use crate::error::Error;
use crate::ingest::{Ingest, PublicationIngest};

use super::{authorization, service};
use crate::tests::support::{PUBLICATION, bundle};

#[test]
fn malformed_bearers_never_reach_database_or_body() {
    let empty = Arc::new(Unimock::new(()));
    let ingest = PublicationIngest {
        transactions: empty.clone(),
        runtime: empty.clone(),
        policy: empty.clone(),
        validator: empty.clone(),
        writer: empty.clone(),
        files: empty,
    };
    for bearer in ["", "abc", "mkc_a", &format!("mkc_{}", "A".repeat(64))] {
        assert!(matches!(
            ingest.authorize(crate::tests::support::PROJECT, bearer),
            Err(Error::Unauthorized)
        ));
    }
}

#[test]
fn contract_errors_end_attempt_and_release_references_without_writing_content() {
    for (error, failure) in [
        (
            ContractError::Invalid {
                reason: Rejection::Tar,
            },
            PublicationFailure::InvalidBundle,
        ),
        (
            ContractError::UnsupportedVersion {
                artifact: ArtifactKind::Envelope,
                version: Some(99),
            },
            PublicationFailure::UnsupportedVersion,
        ),
        (
            ContractError::TooLarge {
                limit: Limit::Decompressed,
            },
            PublicationFailure::TooLarge,
        ),
    ] {
        let queries = Unimock::new((
            PublicationsMock::insert_publication
                .next_call(matching!(_))
                .returns(Ok(())),
            PublicationEventsMock::insert_publication_event
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .n_times(2),
            PublicationsMock::fail_publication
                .next_call(matching!(&PUBLICATION, _))
                .answers_arc(Arc::new(move |_, _, value| {
                    assert_eq!(value, failure);
                    Ok(true)
                })),
            BlobsMock::delete_publication_files
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(())),
        ));
        let ingest = service(
            queries,
            Unimock::new(
                UploadValidatorMock::validate_with_envelope
                    .next_call(matching!(_, _))
                    .returns(Err(error)),
            ),
            Unimock::new(()),
        );
        let error = ingest
            .preflight(authorization(), &mut Cursor::new([]))
            .unwrap_err();
        assert_eq!(error.failure(), failure);
    }
}

#[test]
fn memory_exhaustion_is_retryable_and_never_publishes() {
    let queries = Unimock::new((
        PublicationsMock::insert_publication
            .next_call(matching!(_))
            .returns(Ok(())),
        PublicationEventsMock::insert_publication_event
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .n_times(2),
        PublicationsMock::fail_publication
            .next_call(matching!(&PUBLICATION, PublicationFailure::Internal))
            .returns(Ok(true)),
        BlobsMock::delete_publication_files
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(())),
    ));
    let ingest = service(
        queries,
        Unimock::new(
            UploadValidatorMock::validate_with_envelope
                .next_call(matching!(_, _))
                .returns(Err(ContractError::Unavailable)),
        ),
        Unimock::new(()),
    );

    assert!(matches!(
        ingest.preflight(authorization(), &mut Cursor::new([])),
        Err(Error::Unavailable)
    ));
}

#[test]
fn cleanup_failure_preserves_the_original_contract_rejection() {
    let ingest = service(
        Unimock::new((
            PublicationsMock::insert_publication
                .next_call(matching!(_))
                .returns(Ok(())),
            PublicationEventsMock::insert_publication_event
                .next_call(matching!(_))
                .returns(Ok(())),
            PublicationsMock::fail_publication
                .next_call(matching!(_, _))
                .returns(Err(mkc_store_interface::error::Error::internal(
                    Error::Unavailable,
                ))),
        )),
        Unimock::new(
            UploadValidatorMock::validate_with_envelope
                .next_call(matching!(_, _))
                .returns(Err(ContractError::Invalid {
                    reason: Rejection::Tar,
                })),
        ),
        Unimock::new(()),
    );
    assert!(matches!(
        ingest.preflight(authorization(), &mut Cursor::new([])),
        Err(Error::InvalidBundle {
            reason: Rejection::Tar
        })
    ));
}

#[test]
fn storage_failure_releases_all_reserved_paths_and_never_becomes_ready() {
    let file_count = bundle().inventory().files.len() + 1;
    let distinct_hashes = bundle()
        .inventory()
        .files
        .iter()
        .map(|file| file.sha256.clone())
        .chain(
            bundle()
                .artifacts()
                .iter()
                .map(|artifact| BlobHash::digest(&artifact.bytes).to_string()),
        )
        .collect::<HashSet<_>>()
        .len();
    let ingest = service(
        Unimock::new((
            PublicationsMock::insert_publication
                .next_call(matching!(_))
                .returns(Ok(())),
            PublicationEventsMock::insert_publication_event
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .n_times(3),
            PublicationsMock::validate_publication
                .next_call(matching!(_, _))
                .returns(Ok(true)),
            PublicationsMock::publication_by_identity
                .next_call(matching!(_, _, _))
                .returns(Ok(None)),
            BlobsMock::blob
                .each_call(matching!(_))
                .answers(&|_, _, _| Ok(None))
                .n_times(distinct_hashes),
            BlobsMock::insert_blob
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .n_times(distinct_hashes),
            BlobsMock::insert_publication_file
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .n_times(file_count),
            PublicationsMock::fail_publication
                .next_call(matching!(&PUBLICATION, PublicationFailure::Internal))
                .returns(Ok(true)),
            BlobsMock::delete_publication_files
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(())),
        )),
        super::validator(bundle()),
        Unimock::new(
            BlobWriterMock::write
                .next_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, pending, _| {
                    assert_eq!(pending.len(), 3);
                    Err(Error::internal(Error::Unavailable))
                })),
        ),
    );
    assert!(matches!(
        ingest.preflight(authorization(), &mut Cursor::new([])),
        Err(Error::Internal(_))
    ));
}
