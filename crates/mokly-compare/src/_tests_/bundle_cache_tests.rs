//! Held locks, optional maintenance, and global stage reservations use mocked IO.

use std::io::{Cursor, Read};
use std::sync::Arc;

use mokly_git::control::CancellationMock;
use mokly_platform::error;
use mokly_platform::locks::{FileLock, LocksMock};
use mokly_sidecar::bundle_outcomes::SkipReason;
use mokly_sidecar::bundle_store::RecordToken;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_cache_types::{
    BundleCache, BundleReceipt, BundleRecord, CompilationRead, Mutation, OpenBundle, RawRead,
};
use crate::cache::DiskCache;
use crate::cache_types::{ReporterMock, StorageMock};
use crate::error::Error;

fn key() -> String {
    "a".repeat(64)
}
fn receipt() -> BundleReceipt {
    BundleReceipt {
        bytes: 1031,
        used: 4,
        publication: RecordToken::new([7; 32]),
        runtime_digest: [3; 32],
    }
}
fn cache(storage: Unimock, locks: Unimock) -> DiskCache {
    DiskCache {
        root: "/cache".into(),
        source_bytes: 1,
        dependency_bytes: 1,
        storage: Arc::new(storage),
        locks: Arc::new(locks),
        clock: Arc::new(Unimock::new(())),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .returns(false),
        )),
        reporter: Arc::new(Unimock::new(
            ReporterMock::opened.each_call(matching!(_)).returns(()),
        )),
    }
}
fn open() -> OpenBundle {
    OpenBundle::Complete {
        input: Box::new(Cursor::new(b"content".to_vec())),
        bytes: 7,
        receipt: receipt(),
    }
}
fn locked() -> error::Error {
    error::Error::Locked {
        path: "/lock".into(),
    }
}

#[test]
fn held_entry_stripes_miss_or_skip_without_waiting_or_reading_data() {
    let storage = Unimock::new(
        StorageMock::prepare
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    );
    let locks = Unimock::new((
        LocksMock::try_lock_shared
            .each_call(matching!(_))
            .answers(&|_, _| Err(locked())),
        LocksMock::try_lock
            .some_call(matching!(_))
            .returns(Err(locked())),
    ));
    let cache = cache(storage, locks);
    assert_eq!(
        cache.compilation(&key()).unwrap(),
        CompilationRead::Contended
    );
    assert!(matches!(cache.read(&key()).unwrap(), RawRead::Contended));
    assert_eq!(
        cache.replace(&key(), b"new", [3; 32]).unwrap(),
        Mutation::Skipped(SkipReason::Contended)
    );
}

#[test]
fn namespace_contention_and_failed_access_updates_keep_the_loaded_file() {
    for failed_update in [false, true] {
        let storage = if failed_update {
            Unimock::new((
                StorageMock::prepare
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(())),
                StorageMock::bundle_open
                    .some_call(matching!(_))
                    .returns(Ok(open())),
                StorageMock::bundle_records
                    .each_call(matching!(_, _))
                    .answers(&|_, _, _| Ok(vec![])),
                StorageMock::bundle_receipt
                    .some_call(matching!(_, _, false))
                    .returns(Err(Error::UnsafeCache {
                        path: "/receipt".into(),
                    })),
            ))
        } else {
            Unimock::new((
                StorageMock::prepare
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(())),
                StorageMock::bundle_open
                    .some_call(matching!(_))
                    .returns(Ok(open())),
            ))
        };
        let locks = Unimock::new((
            LocksMock::try_lock_shared
                .some_call(matching!(_))
                .returns(Ok(Box::new(Unimock::new(())) as Box<dyn FileLock>)),
            LocksMock::try_lock
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    if failed_update {
                        Ok(Box::new(Unimock::new(())))
                    } else {
                        Err(locked())
                    }
                })),
        ));
        let RawRead::Entry(mut entry) = cache(storage, locks).read(&key()).unwrap() else {
            panic!("loaded entry was lost")
        };
        let mut bytes = vec![];
        entry.input.read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes, b"content");
        assert_eq!(entry.maintenance.is_some(), failed_update);
        assert_eq!(entry.token, RecordToken::new([7; 32]));
    }
}

#[test]
fn active_stage_reservations_skip_a_write_before_any_payload_is_staged() {
    let stages = (0..8)
        .map(|index| BundleRecord {
            key: format!("{index:02x}{}", "b".repeat(62)),
            bytes: 64 * 1024 * 1024,
            receipt: Some(BundleReceipt {
                bytes: 64 * 1024 * 1024,
                used: index + 1,
                publication: RecordToken::new([index as u8; 32]),
                runtime_digest: [3; 32],
            }),
        })
        .collect::<Vec<_>>();
    let storage = Unimock::new((
        StorageMock::prepare
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        StorageMock::bundle_records
            .each_call(matching!((path,_) if path.ends_with("staging")))
            .answers_arc(Arc::new(move |_, _, _| Ok(stages.clone()))),
        StorageMock::bundle_records
            .each_call(matching!((path,_) if path.ends_with("entries") || path.ends_with("trash")))
            .answers(&|_, _, _| Ok(vec![])),
    ));
    let locks = Unimock::new(
        LocksMock::try_lock
            .each_call(matching!(_))
            .answers(&|_, path| {
                if path.ends_with("state.lock") || path.ends_with("stripe-aa.lock") {
                    Ok(Box::new(Unimock::new(())))
                } else {
                    Err(locked())
                }
            }),
    );
    let cache = cache(storage, locks);
    assert_eq!(
        cache.replace(&key(), b"new recipe", [3; 32]).unwrap(),
        Mutation::Skipped(SkipReason::Capacity)
    );
}
