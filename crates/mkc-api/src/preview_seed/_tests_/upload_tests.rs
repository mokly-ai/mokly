//! Upload retries use a fresh plan once and never read already durable blobs.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use chrono::{DateTime, Utc};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_file_store_interface::seed::SeedStoreMock;
use mkc_publications::error;
use mkc_publications::ingest::{BlobTarget, IngestMock, Ingested, Plan, UploadAuthorization};
use mkc_store_interface::publication::{Publication, PublicationState};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::preview_seed::error::Error;
use crate::preview_seed::upload::{CatalogueUpload, IngestCatalogueUpload};

fn now() -> DateTime<Utc> {
    "2026-10-30T12:00:00Z".parse().unwrap()
}

fn project() -> ProjectId {
    ProjectId(Uuid::from_u128(1))
}

fn authorization() -> UploadAuthorization {
    UploadAuthorization::for_tests(
        project(),
        "mokly-ai".parse().unwrap(),
        "mokly-cloud".parse().unwrap(),
    )
}

fn ingested() -> Ingested {
    Ingested {
        publication: Publication {
            id: PublicationId(Uuid::from_u128(3)),
            project_id: project(),
            build_id: None,
            build_failure_event_id: None,
            metadata: None,
            state: PublicationState::Ready,
            failure: None,
            changes: None,
            created_at: now(),
            deadline: now(),
            expired_at: None,
        },
        organization_slug: "mokly-ai".parse().unwrap(),
        project_slug: "mokly-cloud".parse().unwrap(),
        replay: false,
    }
}

#[test]
fn expired_completion_starts_one_fresh_plan_and_reads_only_missing_blobs() {
    let hash = BlobHash::digest(b"catalogue");
    let first = PublicationId(Uuid::from_u128(2));
    let second = PublicationId(Uuid::from_u128(3));
    let target = BlobTarget {
        project: project(),
        key: BlobKey {
            hash: hash.clone(),
            incarnation: Uuid::from_u128(4),
        },
        size: 9,
        durable: false,
        deadline: now(),
    };
    let expected_target = target.clone();
    let ingest = Unimock::new((
        IngestMock::authorize
            .each_call(matching!((id, bearer) if *id == project() && *bearer == "private bearer"))
            .answers(&|_, _, _| Ok(authorization()))
            .n_times(2),
        IngestMock::preflight.stub(|each| {
            let hash = hash.clone();
            each.call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| {
                    Ok(Plan {
                        upload: first,
                        project: project(),
                        expires_at: now(),
                        missing: vec![hash.clone()],
                    })
                }))
                .once()
                .then()
                .answers_arc(Arc::new(move |_, _, _| {
                    Ok(Plan {
                        upload: second,
                        project: project(),
                        expires_at: now(),
                        missing: vec![],
                    })
                }))
                .once();
        }),
        IngestMock::blob_target
            .some_call(
                matching!((_, upload, hash) if upload.0 == Uuid::from_u128(2)
            && *hash == Some(&BlobHash::digest(b"catalogue"))),
            )
            .returns(Ok(target)),
        IngestMock::store_blob
            .some_call(
                matching!((target, bytes) if target.size == 9 && bytes.as_ref() == b"catalogue"),
            )
            .answers_arc(Arc::new(move |_, target, _| {
                assert_eq!(target, &expected_target);
                Ok(())
            })),
        IngestMock::complete.stub(|each| {
            each.call(matching!(_, _))
                .answers(&|_, _, _| Err(error::Error::Expired))
                .once()
                .then()
                .answers(&|_, _, _| Ok(ingested()))
                .once();
        }),
    ));
    let files = Unimock::new(SeedStoreMock::get.some_call(matching!((name, _) if
        name.as_str().strip_prefix("seed/run/catalogue/blobs/") == Some(BlobHash::digest(b"catalogue").as_str())))
        .returns(Ok(Some(b"catalogue".to_vec()))));
    let uploader = IngestCatalogueUpload {
        files: Arc::new(files),
        ingest: Arc::new(ingest),
    };
    let result = uploader.publish("run", project(), "private bearer", b"plan archive");
    assert!(result.is_ok(), "fresh upload attempt failed: {result:?}");
    assert_eq!(result.unwrap().publication.id, second);
}

#[test]
fn a_second_expiry_or_another_upload_failure_does_not_restart() {
    for expired in [true, false] {
        let calls = if expired { 2 } else { 1 };
        let ingest = Unimock::new((
            IngestMock::authorize
                .each_call(matching!(_, _))
                .answers(&|_, _, _| Ok(authorization()))
                .n_times(calls),
            IngestMock::preflight
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| {
                    Err(if expired {
                        error::Error::Expired
                    } else {
                        error::Error::Forbidden
                    })
                }))
                .n_times(calls),
        ));
        let uploader = IngestCatalogueUpload {
            files: Arc::new(Unimock::new(())),
            ingest: Arc::new(ingest),
        };
        let result = uploader.publish("run", project(), "private bearer", b"plan archive");
        assert!(result.is_err());
        let error = result.unwrap_err();
        let Error::Internal(error) = error else {
            panic!("unexpected error");
        };
        let source = error
            .source_chain()
            .find_map(|error| error.downcast_ref::<error::Error>())
            .unwrap();
        assert_eq!(matches!(source, error::Error::Expired), expired);
        assert_eq!(matches!(source, error::Error::Forbidden), !expired);
    }
}
