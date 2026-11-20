//! Plans store their artifacts and list exactly the hashes this project still needs.

use std::collections::{BTreeMap, BTreeSet};
use std::io::Cursor;
use std::sync::Arc;

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::ProjectId;
use mkc_mokly_contract::error::Rejection;
use mkc_store_interface::blob::{Blob, BlobsMock};
use mkc_store_interface::publication::{PublicationFailure, PublicationsMock};
use mkc_store_interface::publication_event::PublicationEventsMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::blob_writer::BlobWriterMock;
use crate::error::Error;
use crate::ingest::Ingest;
use crate::tests::support::{PROJECT, PUBLICATION, bundle, now};

use super::{authorization, service, validator};

/// Declared size per hash, including the marker the service reserves itself.
fn declared() -> BTreeMap<BlobHash, i64> {
    let mut sizes: BTreeMap<BlobHash, i64> = bundle()
        .inventory()
        .files
        .iter()
        .map(|file| (file.sha256.parse().unwrap(), file.size as i64))
        .collect();
    for artifact in bundle().artifacts() {
        sizes.insert(
            BlobHash::digest(&artifact.bytes),
            artifact.bytes.len() as i64,
        );
    }
    sizes
}

fn artifact_hashes() -> BTreeSet<BlobHash> {
    bundle()
        .artifacts()
        .iter()
        .map(|artifact| BlobHash::digest(&artifact.bytes))
        .collect()
}

fn queries(durable: BTreeSet<BlobHash>, sizes: BTreeMap<BlobHash, i64>) -> Unimock {
    queries_for_project(PROJECT, durable, sizes)
}

fn queries_for_project(
    durable_project: ProjectId,
    durable: BTreeSet<BlobHash>,
    sizes: BTreeMap<BlobHash, i64>,
) -> Unimock {
    let file_count = bundle().inventory().files.len() + 1;
    let new = if durable_project == PROJECT {
        sizes.len() - durable.len()
    } else {
        sizes.len()
    };
    Unimock::new((
        PublicationsMock::insert_publication
            .next_call(matching!(_))
            .returns(Ok(())),
        PublicationEventsMock::insert_publication_event
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .n_times(2),
        PublicationsMock::validate_publication
            .next_call(matching!(_, _))
            .answers(&|_, _, metadata| {
                assert_eq!(metadata.base_ref.as_deref(), Some("HEAD~1"));
                assert_eq!(
                    metadata.base_sha.as_deref(),
                    Some("4150326c615212f0fc9d9153cde75fae6aaf308f")
                );
                Ok(true)
            }),
        PublicationsMock::publication_by_identity
            .next_call(matching!(_, _, _))
            .returns(Ok(None)),
        BlobsMock::blob
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, project, hash| {
                Ok(
                    (project == durable_project && durable.contains(hash)).then(|| Blob {
                        project_id: project,
                        key: BlobKey {
                            hash: hash.clone(),
                            incarnation: Uuid::from_u128(9),
                        },
                        size: sizes[hash],
                        content_type: "text/html".into(),
                        ref_count: 1,
                        deleting: false,
                        unreferenced_at: None,
                        stored_at: Some(now()),
                    }),
                )
            })),
        BlobsMock::insert_blob
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .n_times(new),
        BlobsMock::insert_publication_file
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .n_times(file_count),
    ))
}

#[test]
fn a_first_plan_stores_the_artifacts_and_lists_every_other_hash_in_order() {
    let sizes = declared();
    let expected: Vec<BlobHash> = sizes
        .keys()
        .filter(|hash| !artifact_hashes().contains(*hash))
        .cloned()
        .collect();
    let ingest = service(
        queries(BTreeSet::new(), sizes),
        validator(bundle()),
        Unimock::new(
            BlobWriterMock::write
                .next_call(matching!(_, _, _))
                .answers_arc(Arc::new(|_, _, pending, _| {
                    let written: BTreeSet<_> =
                        pending.iter().map(|blob| blob.key.hash.clone()).collect();
                    assert_eq!(written, artifact_hashes());
                    for blob in pending {
                        assert_eq!(BlobHash::digest(&blob.bytes), blob.key.hash);
                    }
                    Ok(())
                })),
        ),
    );
    let plan = ingest
        .preflight(authorization(), &mut Cursor::new([]))
        .unwrap();
    assert_eq!(plan.upload, PUBLICATION);
    assert_eq!(plan.project, PROJECT);
    assert_eq!(plan.expires_at, now() + chrono::Duration::minutes(60));
    assert_eq!(plan.missing, expected);
}

#[test]
fn hashes_the_project_already_stored_are_never_missing() {
    let sizes = declared();
    let durable: BTreeSet<BlobHash> = sizes
        .keys()
        .filter(|hash| !artifact_hashes().contains(*hash))
        .take(5)
        .cloned()
        .collect();
    let ingest = service(
        queries(durable.clone(), sizes.clone()),
        validator(bundle()),
        Unimock::new(
            BlobWriterMock::write
                .next_call(matching!(_, _, _))
                .returns(Ok(())),
        ),
    );
    let plan = ingest
        .preflight(authorization(), &mut Cursor::new([]))
        .unwrap();
    assert_eq!(
        plan.missing.len(),
        sizes.len() - artifact_hashes().len() - 5
    );
    assert!(plan.missing.iter().all(|hash| !durable.contains(hash)));
}

#[test]
fn another_project_does_not_satisfy_the_missing_list() {
    let sizes = declared();
    let durable: BTreeSet<BlobHash> = sizes
        .keys()
        .filter(|hash| !artifact_hashes().contains(*hash))
        .take(5)
        .cloned()
        .collect();
    let other_project = ProjectId(uuid::Uuid::from_u128(99));
    let ingest = service(
        queries_for_project(other_project, durable.clone(), sizes.clone()),
        validator(bundle()),
        Unimock::new(
            BlobWriterMock::write
                .next_call(matching!(_, _, _))
                .returns(Ok(())),
        ),
    );
    let plan = ingest
        .preflight(authorization(), &mut Cursor::new([]))
        .unwrap();
    assert!(durable.iter().all(|hash| plan.missing.contains(hash)));
}

#[test]
fn a_declared_size_that_conflicts_with_stored_content_is_invalid() {
    let mut sizes = declared();
    let conflicting = sizes.keys().next().cloned().unwrap();
    *sizes.get_mut(&conflicting).unwrap() += 1;
    let queries = Unimock::new((
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
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, project, hash| {
                Ok(Some(Blob {
                    project_id: project,
                    key: BlobKey {
                        hash: hash.clone(),
                        incarnation: Uuid::from_u128(9),
                    },
                    size: sizes[hash],
                    content_type: "text/html".into(),
                    ref_count: 1,
                    deleting: false,
                    unreferenced_at: None,
                    stored_at: Some(now()),
                }))
            })),
        PublicationsMock::validate_publication
            .next_call(matching!(&PUBLICATION, _))
            .returns(Ok(true)),
        PublicationsMock::fail_publication
            .next_call(matching!(&PUBLICATION, PublicationFailure::InvalidBundle))
            .returns(Ok(true)),
        BlobsMock::delete_publication_files
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(())),
    ));
    let ingest = service(queries, validator(bundle()), Unimock::new(()));
    assert!(matches!(
        ingest.preflight(authorization(), &mut Cursor::new([])),
        Err(Error::InvalidBundle {
            reason: Rejection::ArtifactDigest
        })
    ));
}
