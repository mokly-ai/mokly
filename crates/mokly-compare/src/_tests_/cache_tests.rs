//! Shared leases, durable publication order and cancellation through mocked IO.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use mokly_git::control::{CancellationMock, ClockMock};
use mokly_platform::error;
use mokly_platform::locks::LocksMock;
use unimock::{MockFn, Unimock, matching};

use crate::cache::DiskCache;
use crate::cache_types::{
    BuilderMock, Cache, Kind, Receipt, Record, Reporter, ReporterMock, StorageMock,
};
use crate::error::Error;
use crate::locations::{OnceReporter, plain_line, repository_key};

pub(super) fn key() -> String {
    "a".repeat(40)
}
pub(super) fn receipt() -> Receipt {
    Receipt {
        bytes: 1025,
        used: 7,
    }
}
pub(super) fn locks() -> Unimock {
    Unimock::new((
        LocksMock::try_lock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Box::new(Unimock::new(())))),
        LocksMock::try_lock_shared
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Box::new(Unimock::new(())))),
    ))
}
fn cache(storage: Unimock, locks: Unimock) -> DiskCache {
    DiskCache {
        root: "/cache".into(),
        source_bytes: 5000,
        dependency_bytes: 9000,
        storage: Arc::new(storage),
        locks: Arc::new(locks),
        clock: Arc::new(Unimock::new(())),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .returns(false),
        )),
        reporter: Arc::new(Unimock::new(
            ReporterMock::opened.next_call(matching!(_)).returns(()),
        )),
    }
}

#[test]
fn hit_uses_shared_lease_and_recounted_receipt_without_hashing_or_building() {
    let storage = Unimock::new((
        StorageMock::stages
            .each_call(matching!((path) if path.ends_with("trash")))
            .answers(&|_, _| Ok(vec![])),
        StorageMock::prepare
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        StorageMock::inspect
            .next_call(matching!(_, 5000))
            .returns(Ok(Some(receipt()))),
        StorageMock::records
            .next_call(matching!(_))
            .returns(Ok(vec![Record {
                key: key(),
                receipt: receipt(),
            }])),
        StorageMock::touch
            .next_call(matching!((_, receipt) if receipt.used == 8 && receipt.bytes == 1025))
            .returns(Ok(())),
    ));
    let lease = cache(storage, locks())
        .get(Kind::Sources, &key(), &Unimock::new(()))
        .unwrap();
    assert!(lease.directory.ends_with(format!("{}/data", key())));
}

#[test]
fn miss_syncs_data_then_evicts_oldest_unleased_entry_before_publication() {
    let old = "b".repeat(40);
    let records = vec![Record {
        key: old,
        receipt: Receipt {
            bytes: 4000,
            used: 1,
        },
    }];
    let storage = Unimock::new((
        StorageMock::stages.each_call(matching!((path) if path.ends_with("trash"))).answers(&|_, _| Ok(vec![])),
        StorageMock::prepare
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        StorageMock::inspect
            .next_call(matching!(_, _))
            .returns(Ok(None)),
        StorageMock::inspect
            .next_call(matching!(_, _))
            .returns(Ok(None)),
        StorageMock::records
            .next_call(matching!(_))
            .returns(Ok(vec![])),
        StorageMock::stages
            .some_call(matching!((path) if path.ends_with("staging")))
            .answers(&|_, _| Ok(vec![])).once(),
        (StorageMock::remove.next_call(matching!(_)).returns(Ok(())),
        StorageMock::remove.next_call(matching!(_)).returns(Ok(()))),
        StorageMock::size
            .next_call(matching!(_, 5000))
            .returns(Ok(1000)),
        StorageMock::synchronize
            .next_call(matching!(_))
            .returns(Ok(())),
        StorageMock::records
            .next_call(matching!(_))
            .returns(Ok(records)),
        StorageMock::retire
            .next_call(matching!((path, trash) if path.ends_with("b".repeat(40)) && trash.ends_with("trash")))
            .returns(Ok(())),
        StorageMock::receipt
            .next_call(matching!((_, receipt) if receipt.used == 2 && receipt.bytes == 2024))
            .returns(Ok(())),
        StorageMock::publish
            .next_call(matching!(_, _))
            .returns(Ok(())),
        StorageMock::inspect
            .next_call(matching!(_, _))
            .returns(Ok(Some(Receipt {
                bytes: 2024,
                used: 2,
            }))),
        StorageMock::records
            .next_call(matching!(_))
            .returns(Ok(vec![])),
        StorageMock::touch
            .next_call(matching!(_, _))
            .returns(Ok(())),
    ));
    let builder = Unimock::new(
        BuilderMock::build
            .next_call(matching!((path) if path.ends_with("data")))
            .returns(Ok(())),
    );
    assert!(
        cache(storage, locks())
            .get(Kind::Sources, &key(), &builder)
            .is_ok()
    );
}

#[test]
fn contended_entry_can_be_cancelled_before_any_namespace_lock() {
    let storage = Unimock::new((
        StorageMock::stages
            .each_call(matching!((path) if path.ends_with("trash")))
            .answers(&|_, _| Ok(vec![])),
        StorageMock::prepare
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    ));
    let locks = Unimock::new(
        LocksMock::try_lock_shared
            .next_call(matching!(_))
            .returns(Err(error::Error::Locked {
                path: "/entry".into(),
            })),
    );
    let cache = DiskCache {
        root: "/cache".into(),
        source_bytes: 5000,
        dependency_bytes: 9000,
        storage: Arc::new(storage),
        locks: Arc::new(locks),
        clock: Arc::new(Unimock::new(
            ClockMock::pause.next_call(matching!(_)).returns(()),
        )),
        cancellation: Arc::new(Unimock::new((
            CancellationMock::cancelled
                .next_call(matching!())
                .returns(false),
            CancellationMock::cancelled
                .next_call(matching!())
                .returns(true),
        ))),
        reporter: Arc::new(Unimock::new(
            ReporterMock::opened.next_call(matching!(_)).returns(()),
        )),
    };
    assert!(matches!(
        cache.get(Kind::Sources, &key(), &Unimock::new(())),
        Err(Error::Cancelled)
    ));
}

#[test]
fn announcement_is_once_for_both_namespaces_and_plain_bytes_are_exact() {
    let reporter: &dyn Reporter = &OnceReporter {
        announced: AtomicBool::new(false),
        reporter: Arc::new(Unimock::new(
            ReporterMock::opened.next_call(matching!(_)).returns(()),
        )),
    };
    reporter.opened(Path::new("/cache"));
    reporter.opened(Path::new("/cache"));
    assert_eq!(plain_line(Path::new("/cache")), "Mokly cache: /cache\n");
    assert_eq!(repository_key(Path::new("/repo")).len(), 64);
    assert_ne!(
        repository_key(Path::new("/repo")),
        repository_key(Path::new("/other"))
    );
}

#[test]
fn exclusive_recheck_reuses_an_entry_completed_after_the_initial_miss() {
    let storage = Unimock::new((
        StorageMock::prepare
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        StorageMock::stages
            .each_call(matching!((path) if path.ends_with("trash")))
            .answers(&|_, _| Ok(vec![])),
        StorageMock::inspect
            .next_call(matching!(_, _))
            .returns(Ok(None)),
        StorageMock::inspect
            .next_call(matching!(_, _))
            .returns(Ok(Some(receipt()))),
        StorageMock::inspect
            .next_call(matching!(_, _))
            .returns(Ok(Some(receipt()))),
        StorageMock::records
            .next_call(matching!(_))
            .returns(Ok(vec![])),
        StorageMock::touch
            .next_call(matching!(_, _))
            .returns(Ok(())),
    ));
    assert!(
        cache(storage, locks())
            .get(Kind::Sources, &key(), &Unimock::new(()))
            .is_ok()
    );
}
