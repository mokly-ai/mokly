//! Canonical durability-marker lock ordering.

#![allow(clippy::unwrap_used)]

use std::sync::{Arc, Mutex, mpsc};

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::ProjectId;
use mkc_store_interface::blob::BlobsMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::{CompletedBlob, ParallelBlobWriter};
use crate::transaction::{QueryWork, TransactionsMock};

fn key(bytes: &[u8], incarnation: u128) -> BlobKey {
    BlobKey {
        hash: BlobHash::digest(bytes),
        incarnation: Uuid::from_u128(incarnation),
    }
}

#[test]
fn marker_batch_touches_blobs_in_ascending_project_and_hash_order() {
    let mut keys = vec![
        (ProjectId(Uuid::from_u128(2)), key(b"first", 1)),
        (ProjectId(Uuid::from_u128(1)), key(b"second", 2)),
        (ProjectId(Uuid::from_u128(1)), key(b"third", 3)),
    ];
    keys.reverse();
    let expected = {
        let mut expected = keys.clone();
        expected.sort_by(|left, right| {
            left.0
                .cmp(&right.0)
                .then_with(|| left.1.hash.cmp(&right.1.hash))
        });
        expected.into_iter().map(|(_, key)| key).collect::<Vec<_>>()
    };
    let seen = Arc::new(Mutex::new(Vec::new()));
    let record = seen.clone();
    let queries = Unimock::new(
        BlobsMock::mark_blob_stored
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| {
                record.lock().unwrap().push(key.clone());
                Ok(true)
            }))
            .n_times(keys.len()),
    );
    let batch: Vec<_> = keys
        .into_iter()
        .map(|(project_id, key)| {
            let (marked, _) = mpsc::sync_channel(1);
            CompletedBlob {
                project_id,
                key,
                marked,
            }
        })
        .collect();
    let transactions = Unimock::new(
        TransactionsMock::run
            .next_call(matching!(false, _))
            .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                work(&mut queries.clone())
            })),
    );
    let writer = ParallelBlobWriter {
        files: Arc::new(Unimock::new(())),
        transactions: Arc::new(transactions),
        runtime: Arc::new(Unimock::new(())),
        worker_count: 1,
    };

    writer.mark_batch(&batch).unwrap();

    assert_eq!(*seen.lock().unwrap(), expected);
}
