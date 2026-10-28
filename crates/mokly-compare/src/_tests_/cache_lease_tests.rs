//! A lookup without a build leases only a complete entry and never prepares the cache.

use std::sync::Arc;

use mokly_git::control::CancellationMock;
use mokly_platform::locks::LocksMock;
use unimock::{MockFn, Unimock, matching};

use super::cache_tests::{key, locks, receipt};
use crate::cache::DiskCache;
use crate::cache_types::{Cache, Kind, Record, ReporterMock, StorageMock};

/// Cancellation that the cache checks before each lock attempt.
fn active() -> Unimock {
    Unimock::new(
        CancellationMock::cancelled
            .each_call(matching!())
            .returns(false),
    )
}

/// A cache whose collaborators accept only the given clauses.
fn cache(storage: Unimock, locks: Unimock, reporter: Unimock, cancellation: Unimock) -> DiskCache {
    DiskCache {
        root: "/cache".into(),
        source_bytes: 5000,
        dependency_bytes: 9000,
        storage: Arc::new(storage),
        locks: Arc::new(locks),
        clock: Arc::new(Unimock::new(())),
        cancellation: Arc::new(cancellation),
        reporter: Arc::new(reporter),
    }
}

#[test]
fn a_lookup_leases_a_complete_entry_without_a_build() {
    let storage = Unimock::new((
        StorageMock::directory
            .each_call(matching!(_))
            .answers(&|_, _| Ok(true)),
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
            .next_call(matching!((_, receipt) if receipt.used == 8))
            .returns(Ok(())),
        StorageMock::stages
            .each_call(matching!((path) if path.ends_with("trash")))
            .answers(&|_, _| Ok(vec![])),
    ));
    let reporter = Unimock::new(ReporterMock::opened.next_call(matching!(_)).returns(()));
    let lease = cache(storage, locks(), reporter, active())
        .lease(Kind::Sources, &key())
        .unwrap()
        .unwrap();
    assert!(
        lease
            .directory
            .ends_with(format!("sources/entries/{}/data", key()))
    );
}

#[test]
fn a_lookup_without_a_complete_entry_creates_nothing_and_stays_silent() {
    let absent = Unimock::new(
        StorageMock::directory
            .next_call(matching!((path) if path.ends_with("sources/entries")))
            .returns(Ok(false)),
    );
    assert!(
        cache(absent, Unimock::new(()), Unimock::new(()), Unimock::new(()))
            .lease(Kind::Sources, &key())
            .unwrap()
            .is_none()
    );
    let incomplete = Unimock::new((
        StorageMock::directory
            .each_call(matching!(_))
            .answers(&|_, _| Ok(true)),
        StorageMock::inspect
            .next_call(matching!(_, 5000))
            .returns(Ok(None)),
    ));
    assert!(
        cache(
            incomplete,
            Unimock::new(
                LocksMock::try_lock_shared
                    .next_call(matching!(_))
                    .answers(&|_, _| Ok(Box::new(Unimock::new(())))),
            ),
            Unimock::new(()),
            active(),
        )
        .lease(Kind::Sources, &key())
        .unwrap()
        .is_none()
    );
}
