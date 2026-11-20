//! Current receipts govern each save without a process-local publication record.

use std::io::Cursor;
use std::sync::{Arc, Mutex};

use mokly_sidecar::bundle_outcomes::{CacheOutcome, EntryFault, SkipReason, StoreState, Warnings};
use mokly_sidecar::bundle_store::{BundleStore, ReadOutcome, RecordToken, WriteOutcome};
use unimock::{MockFn, Unimock, matching};

use crate::bundle_cache_types::{BundleCacheMock, CompilationRead, Mutation, RawEntry, RawRead};
use crate::bundle_codec::Codec;
use crate::bundle_fixture::{params, recipe};
use crate::bundle_store::CachedBundles;
use crate::error::Error;

fn runtime() -> [u8; 32] {
    [
        217, 44, 106, 129, 178, 255, 80, 9, 107, 205, 168, 8, 133, 66, 125, 31, 89, 162, 91, 95,
        72, 63, 112, 85, 82, 53, 4, 146, 93, 22, 171, 35,
    ]
}

#[test]
fn current_equal_receipts_skip_encoding_and_external_replacement_or_deletion_is_rechecked() {
    let writes = Arc::new(Mutex::new(vec![]));
    let saved = writes.clone();
    let cache = Unimock::new((
        BundleCacheMock::compilation.stub(|each| {
            each.call(matching!(_))
                .answers(&|_, _| Ok(CompilationRead::Present(runtime())))
                .once()
                .then()
                .answers(&|_, _| Ok(CompilationRead::Present([9; 32])))
                .once()
                .then()
                .answers(&|_, _| Ok(CompilationRead::Absent))
                .once()
                .then()
                .answers(&|_, _| Ok(CompilationRead::Contended));
        }),
        BundleCacheMock::replace
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, bytes, digest| {
                saved.lock().unwrap().push((bytes.len(), digest));
                Ok(Mutation::Written)
            })),
    ));
    let mut store = CachedBundles::new(Arc::new(cache), "current".into());
    store.codec.frame_bytes = 0;
    assert_eq!(store.save(&recipe()), WriteOutcome::Unchanged);
    assert_eq!(writes.lock().unwrap().len(), 0);
    store.codec = Codec::default();
    assert_eq!(store.save(&recipe()), WriteOutcome::Written);
    assert_eq!(store.save(&recipe()), WriteOutcome::Written);
    assert_eq!(
        store.save(&recipe()),
        WriteOutcome::Skipped(SkipReason::Contended)
    );
    let writes = writes.lock().unwrap();
    assert_eq!(writes.len(), 2);
    assert_eq!(
        writes.iter().map(|(_, digest)| *digest).collect::<Vec<_>>(),
        [runtime(), runtime()]
    );
    assert!(writes.iter().all(|(bytes, _)| *bytes > 0));
}

#[test]
fn receipt_faults_keep_entry_and_later_directory_warning_facts() {
    for (read, failed) in [
        (CompilationRead::Damaged, false),
        (CompilationRead::Unreadable, true),
    ] {
        let cache = Unimock::new((
            BundleCacheMock::compilation
                .some_call(matching!(_))
                .returns(Ok(read)),
            BundleCacheMock::replace
                .some_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, _, _| {
                    if failed {
                        Err(Error::UnsafeCache {
                            path: "/cache/state.lock".into(),
                        })
                    } else {
                        Ok(Mutation::Written)
                    }
                })),
        ));
        let store = CachedBundles::new(Arc::new(cache), "current".into());
        let effects = store.save(&recipe()).effects();
        assert_eq!(
            effects.warnings,
            Warnings {
                entry: true,
                directory: failed
            }
        );
        assert_eq!(
            effects.cache,
            Some(if failed {
                CacheOutcome::Unavailable
            } else {
                CacheOutcome::Damaged
            })
        );
        assert_eq!(
            effects.state,
            if failed {
                StoreState::Off
            } else {
                StoreState::On
            }
        );
    }
}

#[test]
fn receipt_lookup_cancellation_is_silent_and_does_not_disable_later_saves() {
    let cache = Unimock::new(BundleCacheMock::compilation.stub(|each| {
        each.call(matching!(_))
            .answers(&|_, _| Err(Error::Cancelled))
            .once()
            .then()
            .answers(&|_, _| Ok(CompilationRead::Present(runtime())));
    }));
    let store = CachedBundles::new(Arc::new(cache), "current".into());
    let cancelled = store.save(&recipe());
    assert_eq!(cancelled, WriteOutcome::Cancelled);
    assert_eq!(cancelled.effects().warnings, Warnings::default());
    assert_eq!(cancelled.effects().state, StoreState::On);
    assert_eq!(store.save(&recipe()), WriteOutcome::Unchanged);
}

#[test]
fn full_payload_load_rejects_a_receipt_that_names_another_compilation() {
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
                runtime_digest: [0; 32],
                maintenance: None,
                guard: Box::new(Unimock::new(())),
            }))),
        BundleCacheMock::cancelled
            .some_call(matching!())
            .returns(false),
        BundleCacheMock::invalidate
            .some_call(matching!(_, _))
            .returns(Ok(Mutation::Invalidated)),
    ));
    let store = CachedBundles::new(Arc::new(cache), "current".into());
    assert!(matches!(
        store.load(&params()),
        ReadOutcome::Rejected {
            fault: EntryFault::Damaged,
            retirement: WriteOutcome::Invalidated,
        }
    ));
}
