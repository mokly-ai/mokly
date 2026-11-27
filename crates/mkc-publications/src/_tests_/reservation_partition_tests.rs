//! Reservation partitions every path from one representative per pending hash.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use mkc_auth::runtime::hash;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_mokly_contract::bundle::PlanBundle;
use mkc_mokly_contract::inventory::MARKER_PATH;
use mkc_store_interface::blob::{Blob, BlobsMock, PublicationFile};
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::publication_event::PublicationEventsMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::ingest::{PublicationIngest, UploadAuthorization};
use crate::policy::AccessPolicyMock;
use crate::reservation::{Prepared, Reservation};
use crate::transaction::{QueryWork, Transactions, TransactionsMock};
use crate::upload_authorization::Credential;

use super::support::{
    PROJECT, bearer, bundle, now, project, publication, runtime, token, transactions,
};

struct Harness {
    ingest: PublicationIngest,
    inserted: Arc<Mutex<Vec<Blob>>>,
    attached: Arc<Mutex<Vec<PublicationFile>>>,
}

fn authorization() -> UploadAuthorization {
    UploadAuthorization {
        project: PROJECT,
        credential: Credential::Project(hash(&bearer())),
        build_id: None,
        organization_slug: super::support::organization_slug(),
        project_slug: super::support::project_slug(),
    }
}

/// Every path the reservation records: declared files plus the private marker.
fn declared(bundle: &PlanBundle) -> Vec<(BlobHash, String, i64)> {
    let marker = bundle
        .artifacts()
        .into_iter()
        .find(|artifact| artifact.path == MARKER_PATH)
        .unwrap();
    let mut files: Vec<_> = bundle
        .inventory()
        .files
        .iter()
        .map(|file| {
            (
                file.sha256.parse().unwrap(),
                file.path.clone(),
                file.size as i64,
            )
        })
        .collect();
    files.push((
        BlobHash::digest(&marker.bytes),
        marker.path,
        marker.bytes.len() as i64,
    ));
    files
}

fn blob_rows(bundle: &PlanBundle, stored_at: Option<DateTime<Utc>>) -> HashMap<BlobHash, Blob> {
    declared(bundle)
        .into_iter()
        .map(|(hash, _, size)| {
            (
                hash.clone(),
                Blob {
                    project_id: PROJECT,
                    key: BlobKey {
                        hash,
                        incarnation: Uuid::from_u128(11),
                    },
                    size,
                    content_type: "application/octet-stream".into(),
                    ref_count: 1,
                    deleting: false,
                    unreferenced_at: None,
                    stored_at,
                },
            )
        })
        .collect()
}

fn harness(initial: HashMap<BlobHash, Blob>, expected_inserts: usize, runs: usize) -> Harness {
    let rows = Arc::new(Mutex::new(initial));
    let inserted = Arc::new(Mutex::new(Vec::new()));
    let attached = Arc::new(Mutex::new(Vec::new()));
    let read_rows = rows.clone();
    let write_rows = rows.clone();
    let recorded_inserts = inserted.clone();
    let recorded_files = attached.clone();
    let common = (
        PublicationsMock::validate_publication
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(true)),
        PublicationsMock::publication_by_identity
            .each_call(matching!(_, _, _))
            .answers(&|_, _, _, _| Ok(None)),
        BlobsMock::blob
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, project, hash| {
                assert_eq!(project, PROJECT);
                Ok(read_rows.lock().unwrap().get(hash).cloned())
            })),
        BlobsMock::insert_publication_file
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, file| {
                recorded_files.lock().unwrap().push(file.clone());
                Ok(())
            })),
        PublicationEventsMock::insert_publication_event
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    );
    let queries = if expected_inserts == 0 {
        Unimock::new(common)
    } else {
        Unimock::new((
            common,
            BlobsMock::insert_blob
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, blob| {
                    write_rows
                        .lock()
                        .unwrap()
                        .insert(blob.key.hash.clone(), blob.clone());
                    recorded_inserts.lock().unwrap().push(blob.clone());
                    Ok(())
                }))
                .n_times(expected_inserts),
        ))
    };
    let transaction: Arc<dyn Transactions> = if runs == 1 {
        transactions(queries)
    } else {
        Arc::new(Unimock::new(
            TransactionsMock::run
                .next_call(matching!(false, _))
                .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                    for _ in 0..runs {
                        work(&mut queries.clone())?;
                    }
                    Ok(())
                })),
        ))
    };
    Harness {
        ingest: PublicationIngest {
            transactions: transaction,
            runtime: runtime(),
            policy: Arc::new(Unimock::new(
                AccessPolicyMock::token
                    .each_call(matching!(_, _, _))
                    .answers(&|_, _, _, _| Ok((project(), token()))),
            )),
            validator: Arc::new(Unimock::new(())),
            writer: Arc::new(Unimock::new(())),
            files: Arc::new(Unimock::new(())),
        },
        inserted,
        attached,
    }
}

fn reserve(harness: &Harness, bundle: &PlanBundle) -> Prepared {
    harness
        .ingest
        .reserve(&authorization(), &publication(), bundle)
        .unwrap()
}

fn distinct_hashes(bundle: &PlanBundle) -> HashSet<BlobHash> {
    declared(bundle)
        .into_iter()
        .map(|(hash, _, _)| hash)
        .collect()
}

#[test]
fn new_blobs_are_pending_once_and_duplicate_paths_reuse_the_inserted_row() {
    let bundle = bundle();
    let distinct = distinct_hashes(&bundle);
    let harness = harness(HashMap::new(), distinct.len(), 1);
    let prepared = reserve(&harness, &bundle);

    assert_eq!(prepared.files.len(), declared(&bundle).len());
    assert_eq!(prepared.pending.len(), distinct.len());
    assert_eq!(harness.inserted.lock().unwrap().len(), distinct.len());
    assert_eq!(
        harness.attached.lock().unwrap().len(),
        declared(&bundle).len()
    );
    assert!(
        distinct.iter().any(|hash| {
            prepared
                .files
                .iter()
                .filter(|file| &file.key.hash == hash)
                .count()
                > 1
                && prepared
                    .pending
                    .iter()
                    .filter(|file| &file.key.hash == hash)
                    .count()
                    == 1
        }),
        "fixture must exercise duplicate content under multiple paths"
    );
}

#[test]
fn durable_existing_blobs_are_reserved_without_becoming_pending() {
    let bundle = bundle();
    let harness = harness(blob_rows(&bundle, Some(now())), 0, 1);
    let prepared = reserve(&harness, &bundle);

    assert_eq!(prepared.files.len(), declared(&bundle).len());
    assert!(prepared.pending.is_empty());
    assert!(harness.inserted.lock().unwrap().is_empty());
}

#[test]
fn reserved_but_unstored_blobs_remain_distinct_pending_work() {
    let bundle = bundle();
    let distinct = distinct_hashes(&bundle);
    let harness = harness(blob_rows(&bundle, None), 0, 1);
    let prepared = reserve(&harness, &bundle);

    assert_eq!(prepared.files.len(), declared(&bundle).len());
    assert_eq!(
        prepared
            .pending
            .iter()
            .map(|file| file.key.hash.clone())
            .collect::<HashSet<_>>(),
        distinct
    );
    assert_eq!(prepared.pending.len(), distinct.len());
    assert!(harness.inserted.lock().unwrap().is_empty());
}

#[test]
fn transaction_retries_rebuild_files_and_pending_without_duplicates() {
    let bundle = bundle();
    let distinct = distinct_hashes(&bundle);
    let harness = harness(blob_rows(&bundle, None), 0, 2);
    let prepared = reserve(&harness, &bundle);

    assert_eq!(prepared.files.len(), declared(&bundle).len());
    assert_eq!(prepared.pending.len(), distinct.len());
    assert!(prepared.existing.is_none());
    assert_eq!(
        harness.attached.lock().unwrap().len(),
        declared(&bundle).len() * 2
    );
}

#[test]
fn reservation_touches_blobs_by_hash_then_path() {
    let bundle = bundle();
    let mut expected: Vec<_> = declared(&bundle)
        .into_iter()
        .map(|(hash, path, _)| (hash, path))
        .collect();
    expected.sort();
    let mut path_order = expected.clone();
    path_order.sort_by(|left, right| left.1.cmp(&right.1));
    assert_ne!(
        path_order, expected,
        "fixture must distinguish path and hash order"
    );
    let harness = harness(HashMap::new(), distinct_hashes(&bundle).len(), 1);

    reserve(&harness, &bundle);

    let actual: Vec<_> = harness
        .attached
        .lock()
        .unwrap()
        .iter()
        .map(|file| (file.key.hash.clone(), file.path.clone()))
        .collect();
    assert_eq!(actual, expected);
}

#[path = "reservation_content_type_tests.rs"]
mod reservation_content_type_tests;
