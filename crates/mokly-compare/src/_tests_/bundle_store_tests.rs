//! Store faults disable once while entry faults and access failures stay recoverable.

use std::io::Cursor;
use std::sync::Arc;

use mokly_sidecar::bundle_outcomes::{CacheOutcome, EntryFault, StoreState, Warnings};
use mokly_sidecar::bundle_store::{BundleStore, ReadMiss, ReadOutcome, RecordToken, WriteOutcome};
use unimock::{MockFn, Unimock, matching};

use crate::bundle_cache_types::{BundleCacheMock, RawEntry, RawRead};
use crate::bundle_codec::Codec;
use crate::bundle_fixture::{params, recipe};
use crate::bundle_store::CachedBundles;
use crate::error::Error;

fn failure() -> Error {
    Error::UnsafeCache {
        path: "/cache/bundles/state.lock".into(),
    }
}

#[test]
fn a_store_fault_disables_later_calls_without_a_second_warning() {
    let cache = Unimock::new(
        BundleCacheMock::read
            .some_call(matching!(_))
            .returns(Err(failure())),
    );
    let store = CachedBundles::new(Arc::new(cache), "current".into());
    let first = store.load(&params());
    assert!(matches!(first, ReadOutcome::Miss(ReadMiss::StoreFault)));
    assert_eq!(
        first.effects().warnings,
        Warnings {
            entry: false,
            directory: true
        }
    );
    let next = store.load(&params());
    assert!(matches!(next, ReadOutcome::Miss(ReadMiss::Disabled)));
    assert_eq!(next.effects().warnings, Warnings::default());
    assert_eq!(store.save(&recipe()), WriteOutcome::Disabled);
}

#[test]
fn a_loaded_recipe_survives_access_maintenance_failure_and_keeps_its_warning() {
    let bytes = Codec::default()
        .encode(&recipe(), "current")
        .unwrap()
        .unwrap();
    let cache = Unimock::new((
        BundleCacheMock::read
            .some_call(matching!(_))
            .returns(Ok(RawRead::Entry(RawEntry {
                bytes: bytes.len() as u64,
                input: Box::new(Cursor::new(bytes)),
                token: RecordToken::new([7; 32]),
                runtime_digest: [
                    217, 44, 106, 129, 178, 255, 80, 9, 107, 205, 168, 8, 133, 66, 125, 31, 89,
                    162, 91, 95, 72, 63, 112, 85, 82, 53, 4, 146, 93, 22, 171, 35,
                ],
                maintenance: Some(failure()),
                guard: Box::new(Unimock::new(())),
            }))),
        BundleCacheMock::cancelled
            .some_call(matching!())
            .returns(false),
    ));
    let store = CachedBundles::new(Arc::new(cache), "current".into());
    let loaded = store.load(&params());
    assert!(matches!(
        loaded,
        ReadOutcome::Hit {
            maintenance: WriteOutcome::StoreFault,
            ..
        }
    ));
    let effects = loaded.effects();
    assert_eq!(effects.cache, Some(CacheOutcome::Hit));
    assert_eq!(
        effects.warnings,
        Warnings {
            entry: false,
            directory: true
        }
    );
    assert_eq!(effects.state, StoreState::Off);
}

#[test]
fn entry_rejection_keeps_both_warning_facts_when_retirement_fails() {
    let cache = Unimock::new((
        BundleCacheMock::read
            .some_call(matching!(_))
            .returns(Ok(RawRead::Damaged(None))),
        BundleCacheMock::invalidate
            .some_call(matching!(_, None))
            .returns(Err(failure())),
    ));
    let store = CachedBundles::new(Arc::new(cache), "current".into());
    let loaded = store.load(&params());
    assert!(matches!(
        loaded,
        ReadOutcome::Rejected {
            fault: EntryFault::Damaged,
            retirement: WriteOutcome::StoreFault
        }
    ));
    assert_eq!(
        loaded.effects().warnings,
        Warnings {
            entry: true,
            directory: true
        }
    );
}

#[test]
fn cancellation_stays_silent_and_does_not_disable_the_store() {
    let cache = Unimock::new(BundleCacheMock::read.stub(|each| {
        each.call(matching!(_))
            .answers(&|_, _| Err(Error::Cancelled))
            .once()
            .then()
            .answers(&|_, _| Ok(RawRead::Absent));
    }));
    let store = CachedBundles::new(Arc::new(cache), "current".into());
    let cancelled = store.load(&params());
    assert!(matches!(cancelled, ReadOutcome::Miss(ReadMiss::Cancelled)));
    assert_eq!(cancelled.effects().warnings, Warnings::default());
    assert_eq!(cancelled.effects().state, StoreState::On);
    assert!(matches!(
        store.load(&params()),
        ReadOutcome::Miss(ReadMiss::Absent)
    ));
}
