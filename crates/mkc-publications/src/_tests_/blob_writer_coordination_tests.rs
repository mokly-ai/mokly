//! Marker coordination stays serialized and batches completed parallel puts.

use std::cell::Cell;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Mutex};

use bytes::Bytes;
use chrono::Duration;
use mkc_auth::runtime::{Runtime, RuntimeMock};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_store_interface::blob::BlobsMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::blob_writer::{BlobWriteReport, BlobWriter, ParallelBlobWriter, PendingBlob};
use crate::error::Error;
use crate::transaction::{QueryWork, TransactionsMock};

use super::support::{PROJECT, now};

thread_local! {
    static TRANSACTION_ID: Cell<usize> = const { Cell::new(usize::MAX) };
}

struct Fixture {
    key: BlobKey,
    bytes: Vec<u8>,
}

fn fixtures(count: usize) -> Vec<Fixture> {
    (0..count)
        .map(|index| {
            let bytes = format!("coordinated-{index}").into_bytes();
            Fixture {
                key: BlobKey {
                    hash: BlobHash::digest(&bytes),
                    incarnation: Uuid::from_u128(index as u128 + 1),
                },
                bytes,
            }
        })
        .collect()
}

fn pending(fixtures: &[Fixture]) -> Vec<PendingBlob<'_>> {
    fixtures
        .iter()
        .map(|fixture| PendingBlob {
            project_id: PROJECT,
            key: &fixture.key,
            bytes: Bytes::copy_from_slice(&fixture.bytes),
        })
        .collect()
}

fn runtime() -> Arc<dyn Runtime> {
    Arc::new(Unimock::new(
        RuntimeMock::now.each_call(matching!()).returns(now()),
    ))
}

#[test]
fn marker_transactions_never_overlap_while_puts_run_in_parallel() {
    let fixtures = fixtures(4);
    let put_barrier = Arc::new(Barrier::new(fixtures.len()));
    let barrier = put_barrier.clone();
    let files = Unimock::new(
        FileStoreMock::put
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| {
                barrier.wait();
                Ok(())
            }))
            .n_times(fixtures.len()),
    );
    let queries = Unimock::new(
        BlobsMock::mark_blob_stored
            .each_call(matching!(_))
            .answers(&|_, _| Ok(true))
            .n_times(fixtures.len()),
    );
    let active = Arc::new(AtomicUsize::new(0));
    let maximum = Arc::new(AtomicUsize::new(0));
    let active_transactions = active.clone();
    let maximum_transactions = maximum.clone();
    let transactions = Unimock::new(
        TransactionsMock::run
            .each_call(matching!(false, _))
            .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                let entered = active_transactions.fetch_add(1, Ordering::AcqRel) + 1;
                maximum_transactions.fetch_max(entered, Ordering::AcqRel);
                let result = work(&mut queries.clone());
                active_transactions.fetch_sub(1, Ordering::AcqRel);
                result
            })),
    );
    let writer = ParallelBlobWriter {
        files: Arc::new(files),
        transactions: Arc::new(transactions),
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

    assert_eq!(maximum.load(Ordering::Acquire), 1);
    assert_eq!(report.written, fixtures.len());
}

#[test]
fn available_markers_are_batched_into_one_transaction() {
    let fixtures = fixtures(16);
    let put_barrier = Arc::new(Barrier::new(fixtures.len()));
    let barrier = put_barrier.clone();
    let files = Unimock::new(
        FileStoreMock::put
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| {
                barrier.wait();
                Ok(())
            }))
            .n_times(fixtures.len()),
    );
    let batches = Arc::new(Mutex::new(HashMap::<usize, usize>::new()));
    let recorded_batches = batches.clone();
    let queries = Unimock::new(
        BlobsMock::mark_blob_stored
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                TRANSACTION_ID.with(|transaction| {
                    *recorded_batches
                        .lock()
                        .unwrap()
                        .entry(transaction.get())
                        .or_default() += 1;
                });
                Ok(true)
            }))
            .n_times(fixtures.len()),
    );
    let calls = Arc::new(AtomicUsize::new(0));
    let transaction_calls = calls.clone();
    let transactions = Unimock::new(
        TransactionsMock::run
            .each_call(matching!(false, _))
            .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                let id = transaction_calls.fetch_add(1, Ordering::AcqRel);
                TRANSACTION_ID.with(|transaction| transaction.set(id));
                let result = work(&mut queries.clone());
                TRANSACTION_ID.with(|transaction| transaction.set(usize::MAX));
                result
            })),
    );
    let writer = ParallelBlobWriter {
        files: Arc::new(files),
        transactions: Arc::new(transactions),
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

    assert!(
        batches.lock().unwrap().values().any(|count| *count > 1),
        "at least one transaction must drain multiple available keys"
    );
    assert!(calls.load(Ordering::Acquire) < fixtures.len());
    assert_eq!(report.written, fixtures.len());
}

#[test]
fn marker_failure_stops_workers_before_they_take_more_items() {
    let worker_count = 4;
    let fixtures = fixtures(worker_count * 2);
    let put_barrier = Arc::new(Barrier::new(worker_count));
    let barrier = put_barrier.clone();
    let files = Unimock::new(
        FileStoreMock::put
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| {
                barrier.wait();
                Ok(())
            }))
            .n_times(worker_count),
    );
    let transactions = Unimock::new(
        TransactionsMock::run
            .each_call(matching!(false, _))
            .answers(&|_, _, _: &mut QueryWork<'_>| Err(Error::Unavailable)),
    );
    let writer = ParallelBlobWriter {
        files: Arc::new(files),
        transactions: Arc::new(transactions),
        runtime: runtime(),
        worker_count,
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
    assert_eq!(report.written, worker_count);
}
