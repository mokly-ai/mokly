//! Locked cache reuse, staging and eviction decisions with mocked IO.

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

fn key() -> String {
    "a".repeat(40)
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
            ReporterMock::opened
                .next_call(matching!((path) if *path == Path::new("/cache")))
                .returns(()),
        )),
    }
}

fn locks() -> Unimock {
    Unimock::new(
        LocksMock::try_lock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Box::new(Unimock::new(())))),
    )
}

#[test]
fn hit_touches_lru_and_never_builds_or_publishes() {
    let storage = Unimock::new((
        StorageMock::prepare
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        StorageMock::clear_staging
            .next_call(matching!(_))
            .returns(Ok(())),
        StorageMock::records
            .next_call(matching!(_))
            .returns(Ok(vec![Record {
                key: key(),
                receipt: Receipt {
                    bytes: 1025,
                    digest: "digest".into(),
                    used: 7,
                },
            }])),
        StorageMock::size
            .next_call(matching!((path, 5000) if path.ends_with("data")))
            .returns(Ok(1)),
        StorageMock::digest
            .next_call(matching!(_, _))
            .returns(Ok("digest".into())),
        StorageMock::receipt
            .next_call(matching!((_, receipt) if receipt.used == 8 && receipt.bytes == 1025))
            .returns(Ok(())),
    ));
    let lease = cache(storage, locks())
        .get(Kind::Sources, &key(), &Unimock::new(()))
        .unwrap();
    assert!(lease.directory.ends_with(format!("{}/data", key())));
}

#[test]
fn miss_evicts_the_oldest_unleased_entry_before_atomic_publish() {
    let old = "b".repeat(40);
    let recent = "c".repeat(40);
    let storage = Unimock::new((
        StorageMock::prepare.each_call(matching!(_)).answers(&|_, _| Ok(())),
        StorageMock::clear_staging.next_call(matching!(_)).returns(Ok(())),
        StorageMock::records.next_call(matching!(_)).returns(Ok(vec![
            Record { key: old.clone(), receipt: Receipt { bytes: 3000, digest: "digest".into(), used: 1 } },
            Record { key: recent, receipt: Receipt { bytes: 1000, digest: "digest".into(), used: 3 } },
        ])),
        StorageMock::remove.next_call(matching!((path) if path.to_string_lossy().contains("entries"))).returns(Ok(())),
        StorageMock::remove.next_call(matching!((path) if path.to_string_lossy().contains("staging"))).returns(Ok(())),
        StorageMock::size.next_call(matching!(_, 5000)).returns(Ok(1000)),
        StorageMock::digest.next_call(matching!(_, _)).returns(Ok("digest".into())),
        StorageMock::remove.next_call(matching!((path) if path.ends_with("b".repeat(40)))).returns(Ok(())),
        StorageMock::receipt.next_call(matching!((_, receipt) if receipt.used == 4 && receipt.bytes == 2024)).returns(Ok(())),
        StorageMock::publish.next_call(matching!((stage, target) if stage.to_string_lossy().contains("staging") && target.to_string_lossy().contains("entries"))).returns(Ok(())),
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
fn announcement_is_once_for_both_namespaces_and_plain_bytes_are_exact() {
    let reporter: &dyn Reporter = &OnceReporter {
        announced: AtomicBool::new(false),
        reporter: Arc::new(Unimock::new(
            ReporterMock::opened
                .next_call(matching!((path) if *path == Path::new("/cache")))
                .returns(()),
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
fn contended_entry_waits_without_holding_the_namespace_and_can_be_cancelled() {
    let storage = Unimock::new(
        StorageMock::prepare
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    );
    let locks = Unimock::new(
        LocksMock::try_lock
            .next_call(matching!((path) if path.ends_with(format!("{}.lock", key()))))
            .returns(Err(error::Error::Locked {
                path: "/entry".into(),
            })),
    );
    let cancellation = Arc::new(Unimock::new((
        CancellationMock::cancelled
            .next_call(matching!())
            .returns(false),
        CancellationMock::cancelled
            .next_call(matching!())
            .returns(true),
    )));
    let clock = Arc::new(Unimock::new(
        ClockMock::pause.next_call(matching!(_)).returns(()),
    ));
    let cache = DiskCache {
        root: "/cache".into(),
        source_bytes: 5000,
        dependency_bytes: 9000,
        storage: Arc::new(storage),
        locks: Arc::new(locks),
        clock,
        cancellation,
        reporter: Arc::new(Unimock::new(
            ReporterMock::opened.next_call(matching!(_)).returns(()),
        )),
    };
    assert!(matches!(
        cache.get(Kind::Sources, &key(), &Unimock::new(())),
        Err(Error::Cancelled)
    ));
}
