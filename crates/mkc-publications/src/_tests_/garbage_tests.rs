//! Deletion is fenced by live reference counts, grace and exact incarnation.

use std::sync::Arc;

use chrono::Duration;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::{FileStoreMock, ObjectPage, StoredObject};
use mkc_store_interface::blob::{Blob, BlobsMock};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::garbage_collection::{BlobGarbageCollector, GarbageCollector};

use super::support::{PROJECT, clock, now, transactions};

fn blob() -> Blob {
    Blob {
        project_id: PROJECT,
        key: BlobKey {
            hash: BlobHash::digest(b"content"),
            incarnation: Uuid::from_u128(10),
        },
        size: 7,
        content_type: "text/plain".into(),
        ref_count: 0,
        deleting: false,
        unreferenced_at: Some(now() - Duration::hours(24)),
        stored_at: None,
    }
}

fn empty_page() -> ObjectPage {
    ObjectPage {
        items: vec![],
        next_cursor: None,
    }
}

#[test]
fn live_references_changed_incarnation_and_young_blobs_survive_collection() {
    for state in ["referenced", "reincarnated", "young"] {
        let candidate = blob();
        let mut current = candidate.clone();
        match state {
            "referenced" => current.ref_count = 1,
            "reincarnated" => current.key.incarnation = Uuid::from_u128(11),
            _ => current.unreferenced_at = Some(now()),
        }
        let exact = (state != "reincarnated").then_some(current);
        let worker = BlobGarbageCollector {
            runtime: clock(),
            transactions: transactions(Unimock::new((
                BlobsMock::garbage_blobs
                    .next_call(matching!(_, 100))
                    .returns(Ok(vec![candidate])),
                BlobsMock::blob_by_key
                    .next_call(matching!(_))
                    .returns(Ok(exact)),
            ))),
            files: Arc::new(Unimock::new(
                FileStoreMock::list
                    .next_call(matching!(None, 100))
                    .returns(Ok(empty_page())),
            )),
        };
        assert_eq!(worker.run_batch(None).unwrap().blobs, 0);
    }
}

#[test]
fn tombstones_delete_the_exact_incarnation_before_the_database_record() {
    let candidate = blob();
    let expected = candidate.key.clone();
    let worker = BlobGarbageCollector {
        runtime: clock(),
        transactions: transactions(Unimock::new((
            BlobsMock::garbage_blobs
                .next_call(matching!(_, _))
                .returns(Ok(vec![candidate.clone()])),
            BlobsMock::blob_by_key
                .next_call(matching!(_))
                .returns(Ok(Some(candidate))),
            BlobsMock::mark_blob_deleting
                .next_call(matching!(_))
                .returns(Ok(true)),
            BlobsMock::delete_blob_record
                .next_call(matching!(_))
                .returns(Ok(true)),
        ))),
        files: Arc::new(Unimock::new((
            FileStoreMock::delete
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| {
                    assert_eq!(key, &expected);
                    Ok(())
                })),
            FileStoreMock::list
                .next_call(matching!(None, 100))
                .returns(Ok(empty_page())),
        ))),
    };
    assert_eq!(worker.run_batch(None).unwrap().blobs, 1);
}

#[test]
fn provider_deletion_failure_leaves_tombstone_retryable() {
    let mut candidate = blob();
    candidate.deleting = true;
    let worker = BlobGarbageCollector {
        runtime: clock(),
        transactions: transactions(Unimock::new((
            BlobsMock::garbage_blobs
                .next_call(matching!(_, _))
                .returns(Ok(vec![candidate.clone()])),
            BlobsMock::blob_by_key
                .next_call(matching!(_))
                .returns(Ok(Some(candidate))),
            BlobsMock::mark_blob_deleting
                .next_call(matching!(_))
                .returns(Ok(true)),
        ))),
        files: Arc::new(Unimock::new(
            FileStoreMock::delete.next_call(matching!(_)).returns(Err(
                mkc_file_store_interface::error::Error::internal(Error::Unavailable),
            )),
        )),
    };
    assert!(worker.run_batch(None).is_err());
}

#[test]
fn orphan_sweep_deletes_only_old_unindexed_incarnations_and_returns_cursor() {
    let orphan = blob().key;
    let live = BlobKey {
        incarnation: Uuid::from_u128(99),
        ..orphan.clone()
    };
    let young = BlobKey {
        incarnation: Uuid::from_u128(100),
        ..orphan.clone()
    };
    let page = ObjectPage {
        items: vec![
            StoredObject {
                key: orphan.clone(),
                created_at: now() - Duration::hours(24),
            },
            StoredObject {
                key: live.clone(),
                created_at: now() - Duration::hours(24),
            },
            StoredObject {
                key: young,
                created_at: now(),
            },
        ],
        next_cursor: Some("next".into()),
    };
    let indexed = live.clone();
    let worker = BlobGarbageCollector {
        runtime: clock(),
        transactions: transactions(Unimock::new((
            BlobsMock::garbage_blobs
                .next_call(matching!(_, _))
                .returns(Ok(vec![])),
            BlobsMock::blob_by_key
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| {
                    Ok((key == &indexed).then(|| Blob {
                        key: indexed.clone(),
                        ..blob()
                    }))
                }))
                .n_times(2),
        ))),
        files: Arc::new(Unimock::new((
            FileStoreMock::list
                .next_call(matching!(Some("cursor"), 100))
                .returns(Ok(page)),
            FileStoreMock::delete
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| {
                    assert_eq!(key, &orphan);
                    Ok(())
                })),
        ))),
    };
    let report = worker.run_batch(Some("cursor")).unwrap();
    assert_eq!(report.orphans, 1);
    assert_eq!(report.next_cursor.as_deref(), Some("next"));
}
