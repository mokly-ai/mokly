//! Parallel blob writer scheduling, deadline and durability-marker behavior.

use std::collections::HashSet;
use std::sync::{Arc, Barrier, Mutex};

use bytes::Bytes;
use chrono::Duration;
use mkc_auth::runtime::{Runtime, RuntimeMock};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::deadline::MAX_OPERATION_DURATION;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_store_interface::blob::BlobsMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::blob_writer::{BlobWriteReport, BlobWriter, ParallelBlobWriter, PendingBlob};
use crate::error::Error;
use crate::transaction::{QueryWork, TransactionsMock};

use super::support::{PROJECT, now, transactions};

struct BlobFixture {
    key: BlobKey,
    bytes: Vec<u8>,
}

fn blobs(count: usize) -> Vec<BlobFixture> {
    (0..count)
        .map(|index| {
            let bytes = format!("blob-{index}").into_bytes();
            BlobFixture {
                key: BlobKey {
                    hash: BlobHash::digest(&bytes),
                    incarnation: Uuid::from_u128(index as u128 + 1),
                },
                bytes,
            }
        })
        .collect()
}

fn pending(blobs: &[BlobFixture]) -> Vec<PendingBlob<'_>> {
    blobs
        .iter()
        .map(|blob| PendingBlob {
            project_id: PROJECT,
            key: &blob.key,
            bytes: Bytes::copy_from_slice(&blob.bytes),
        })
        .collect()
}

fn runtime() -> Arc<dyn Runtime> {
    Arc::new(Unimock::new(
        RuntimeMock::now.each_call(matching!()).returns(now()),
    ))
}

#[test]
fn parallel_completion_is_order_independent_and_marks_every_put() {
    let fixtures = blobs(4);
    let barrier = Arc::new(Barrier::new(fixtures.len()));
    let put = Arc::new(Mutex::new(HashSet::new()));
    let marked = Arc::new(Mutex::new(HashSet::new()));
    let put_record = put.clone();
    let put_barrier = barrier.clone();
    let files = Unimock::new(
        FileStoreMock::put
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, key, bytes, deadline| {
                put_barrier.wait();
                assert_eq!(BlobHash::digest(&bytes), key.hash);
                assert_eq!(deadline.timeout(), MAX_OPERATION_DURATION);
                put_record.lock().unwrap().insert(key.object_name());
                Ok(())
            }))
            .n_times(fixtures.len()),
    );
    let seen_put = put.clone();
    let marked_record = marked.clone();
    let queries = Unimock::new(
        BlobsMock::mark_blob_stored
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| {
                assert!(seen_put.lock().unwrap().contains(&key.object_name()));
                marked_record.lock().unwrap().insert(key.object_name());
                Ok(true)
            }))
            .n_times(fixtures.len()),
    );
    let writer = ParallelBlobWriter {
        files: Arc::new(files),
        transactions: transactions(queries),
        runtime: runtime(),
        worker_count: fixtures.len(),
    };
    let mut report = BlobWriteReport::default();

    writer
        .write(
            now() + Duration::minutes(15),
            &pending(&fixtures),
            &mut report,
        )
        .unwrap();

    let expected: HashSet<_> = fixtures.iter().map(|blob| blob.key.object_name()).collect();
    assert_eq!(*put.lock().unwrap(), expected);
    assert_eq!(*marked.lock().unwrap(), expected);
    assert_eq!(report.written, fixtures.len());
    assert_eq!(
        report.bytes,
        fixtures
            .iter()
            .map(|blob| blob.bytes.len() as u64)
            .sum::<u64>()
    );
}

#[test]
fn first_error_stops_the_remaining_queue_and_is_returned() {
    let fixtures = blobs(3);
    let files = Unimock::new(
        FileStoreMock::put
            .next_call(matching!(_, _, _))
            .returns(Ok(())),
    );
    let transactions = Unimock::new(
        TransactionsMock::run
            .next_call(matching!(false, _))
            .answers(&|_, _, _: &mut QueryWork<'_>| Err(Error::Unavailable)),
    );
    let writer = ParallelBlobWriter {
        files: Arc::new(files),
        transactions: Arc::new(transactions),
        runtime: runtime(),
        worker_count: 1,
    };
    let mut report = BlobWriteReport::default();

    assert!(matches!(
        writer.write(
            now() + Duration::minutes(15),
            &pending(&fixtures),
            &mut report,
        ),
        Err(Error::Unavailable)
    ));
    assert_eq!(report.written, 1);
    assert_eq!(report.bytes, fixtures[0].bytes.len() as u64);
}

#[test]
fn elapsed_deadline_aborts_before_any_put_or_mark() {
    let fixtures = blobs(3);
    let writer = ParallelBlobWriter {
        files: Arc::new(Unimock::new(())),
        transactions: Arc::new(Unimock::new(())),
        runtime: runtime(),
        worker_count: 3,
    };
    let mut report = BlobWriteReport::default();

    assert!(matches!(
        writer.write(now(), &pending(&fixtures), &mut report),
        Err(Error::Expired)
    ));
    assert_eq!(report, BlobWriteReport::default());
}

#[test]
fn put_budget_is_limited_by_remaining_attempt_time() {
    let fixtures = blobs(1);
    let files = Unimock::new(FileStoreMock::put.next_call(matching!(_, _, _)).answers(
        &|_, _, _, deadline| {
            assert_eq!(deadline.timeout(), std::time::Duration::from_secs(17));
            Ok(())
        },
    ));
    let queries = Unimock::new(
        BlobsMock::mark_blob_stored
            .next_call(matching!(_))
            .returns(Ok(true)),
    );
    let writer = ParallelBlobWriter {
        files: Arc::new(files),
        transactions: transactions(queries),
        runtime: runtime(),
        worker_count: 1,
    };
    let mut report = BlobWriteReport::default();

    writer
        .write(
            now() + Duration::seconds(17),
            &pending(&fixtures),
            &mut report,
        )
        .unwrap();

    assert_eq!(report.written, 1);
}

#[test]
fn rejected_durability_marker_is_an_internal_failure() {
    let fixtures = blobs(1);
    let writer = ParallelBlobWriter {
        files: Arc::new(Unimock::new(
            FileStoreMock::put
                .next_call(matching!(_, _, _))
                .returns(Ok(())),
        )),
        transactions: transactions(Unimock::new(
            BlobsMock::mark_blob_stored
                .next_call(matching!(_))
                .returns(Ok(false)),
        )),
        runtime: runtime(),
        worker_count: 1,
    };
    let mut report = BlobWriteReport::default();

    assert!(matches!(
        writer.write(
            now() + Duration::minutes(15),
            &pending(&fixtures),
            &mut report,
        ),
        Err(Error::Internal(_))
    ));
    assert_eq!(report.written, 1);
    assert_eq!(report.bytes, fixtures[0].bytes.len() as u64);
}
