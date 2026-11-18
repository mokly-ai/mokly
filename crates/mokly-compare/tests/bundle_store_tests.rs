//! Real receipts, nonblocking concurrent writers, and replacement eviction.

use std::fs;
use std::sync::{Arc, Barrier, Mutex, mpsc};
use std::thread;

use mokly_compare::bundle_cache_types::{BundleCache, Mutation, RawRead};
use mokly_compare::bundle_store::{CachedBundles, settings_key};
use mokly_sidecar::bundle_outcomes::{EntryFault, SkipReason, StoreState, Warnings};
use mokly_sidecar::bundle_store::{BundleStore, ReadMiss, ReadOutcome, WriteOutcome};

#[path = "bundle_store_support/mod.rs"]
mod support;

#[test]
fn rejected_payloads_and_receipts_are_retired_but_newer_equal_publications_stay() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = Arc::new(support::cache(
        temporary.path().canonicalize().unwrap().join("cache"),
    ));
    let store = CachedBundles::new(cache.clone(), "current".into());
    let params = support::params("entry.ts");
    let recipe = support::recipe(params.clone(), "original");
    assert_eq!(store.save(&recipe), WriteOutcome::Written);
    let first = store.load(&params);
    assert!(matches!(&first, ReadOutcome::Hit { .. }));
    let (_, old) = support::loaded(first);
    assert_eq!(
        support::loaded(store.load(&params)).1,
        old,
        "touch preserves publication identity"
    );
    assert_eq!(store.save(&recipe), WriteOutcome::Unchanged);
    let current = cache
        .storage
        .bundle_records(&cache.root.join("bundles/entries"), 512 * 1024 * 1024)
        .unwrap();
    let digest = current[0].receipt.as_ref().unwrap().runtime_digest;
    assert_eq!(
        cache
            .replace(
                &settings_key(&params).unwrap(),
                &fs::read(support::data(&support::entry(&cache, &params))).unwrap(),
                digest
            )
            .unwrap(),
        Mutation::Written
    );
    let (_, new) = support::loaded(store.load(&params));
    assert_ne!(old, new);
    assert_eq!(
        store.invalidate(&params, &old),
        WriteOutcome::Skipped(SkipReason::Changed)
    );
    assert_eq!(support::loaded(store.load(&params)).0, "original");
    let entry = support::entry(&cache, &params);
    let mut bytes = fs::read(support::data(&entry)).unwrap();
    *bytes.last_mut().unwrap() ^= 1;
    fs::write(support::data(&entry), bytes).unwrap();
    assert!(matches!(
        store.load(&params),
        ReadOutcome::Rejected {
            fault: EntryFault::Damaged,
            retirement: WriteOutcome::Invalidated
        }
    ));
    assert!(matches!(
        store.load(&params),
        ReadOutcome::Miss(ReadMiss::Absent)
    ));
    assert_eq!(store.save(&recipe), WriteOutcome::Written);
    fs::write(support::receipt(&entry), b"broken receipt").unwrap();
    assert!(matches!(
        store.load(&params),
        ReadOutcome::Rejected {
            fault: EntryFault::Damaged,
            retirement: WriteOutcome::Invalidated
        }
    ));
    assert!(matches!(
        store.load(&params),
        ReadOutcome::Miss(ReadMiss::Absent)
    ));
}

#[test]
fn malformed_entry_structure_only_skips_writes_and_keeps_unrelated_hits_available() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = Arc::new(support::cache(
        temporary.path().canonicalize().unwrap().join("cache"),
    ));
    let store = CachedBundles::new(cache.clone(), "current".into());
    let a = support::params("a.ts");
    let b = support::params("b.ts");
    assert_eq!(
        store.save(&support::recipe(a.clone(), "a")),
        WriteOutcome::Written
    );
    assert_eq!(
        store.save(&support::recipe(b.clone(), "b")),
        WriteOutcome::Written
    );
    fs::create_dir(support::entry(&cache, &a).join("data/extra")).unwrap();
    let b_load = store.load(&b);
    assert!(matches!(&b_load, ReadOutcome::Hit { .. }));
    assert_eq!(b_load.effects().state, StoreState::On);
    assert_eq!(
        store.save(&support::recipe(support::params("c.ts"), "c")),
        WriteOutcome::Skipped(SkipReason::Capacity)
    );
    let rejected = store.load(&a);
    assert!(matches!(
        &rejected,
        ReadOutcome::Rejected {
            fault: EntryFault::Damaged,
            retirement: WriteOutcome::Invalidated
        }
    ));
    assert_eq!(
        rejected.effects().warnings,
        Warnings {
            entry: true,
            directory: false
        }
    );
    assert_eq!(rejected.effects().state, StoreState::On);
    assert_eq!(support::loaded(store.load(&b)).0, "b");
}

#[test]
fn two_writers_and_a_reader_never_observe_a_paused_partial_stage() {
    let temporary = tempfile::tempdir().unwrap();
    let mut cache = support::cache(temporary.path().canonicalize().unwrap().join("cache"));
    let (ready, waiting) = mpsc::channel();
    let resume = Arc::new(Barrier::new(2));
    cache.storage = Arc::new(support::paused::PausedStorage {
        inner: cache.storage.clone(),
        ready: Mutex::new(Some(ready)),
        resume: resume.clone(),
    });
    let cache = Arc::new(cache);
    let store = Arc::new(CachedBundles::new(cache.clone(), "current".into()));
    let params = support::params("entry.ts");
    let writing = store.clone();
    let first = support::recipe(params.clone(), "first writer");
    let writer = thread::spawn(move || writing.save(&first));
    waiting.recv().unwrap();
    assert!(matches!(
        store.load(&params),
        ReadOutcome::Miss(ReadMiss::Contended)
    ));
    assert_eq!(
        store.save(&support::recipe(params.clone(), "second writer")),
        WriteOutcome::Skipped(SkipReason::Contended)
    );
    let key = settings_key(&params).unwrap();
    let mut collision = key.clone();
    collision.replace_range(63..64, if key.ends_with('f') { "e" } else { "f" });
    assert!(matches!(
        cache.read(&collision).unwrap(),
        RawRead::Contended
    ));
    assert!(!support::entry(&cache, &params).exists());
    assert!(
        !writer.is_finished(),
        "the first writer remains at its explicit barrier"
    );
    resume.wait();
    assert_eq!(writer.join().unwrap(), WriteOutcome::Written);
    assert_eq!(support::loaded(store.load(&params)).0, "first writer");
}

#[test]
fn replacement_evicts_the_oldest_other_key_in_its_own_stripe_within_the_byte_bound() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = support::cache(temporary.path().canonicalize().unwrap().join("cache"));
    let target = format!("aa{}", "0".repeat(62));
    let victim = format!("aa{}", "1".repeat(62));
    cache.read(&target).unwrap();
    support::sparse(&cache, &target, 1024, 99);
    support::sparse(&cache, &victim, 64 * 1024 * 1024 - 1024, 1);
    let mut kept = vec![];
    for index in 2..9 {
        let key = format!("{index:02x}{}", "2".repeat(62));
        let charge = if index == 8 { 63 } else { 64 };
        support::sparse(&cache, &key, charge * 1024 * 1024 - 1024, index);
        kept.push(key);
    }
    let _leases = kept
        .iter()
        .skip(1)
        .map(|key| {
            cache
                .locks
                .try_lock_shared(&support::stripe(&cache, key))
                .unwrap()
        })
        .collect::<Vec<_>>();
    assert_eq!(
        cache
            .replace(&target, &vec![0; 2 * 1024 * 1024], [3; 32])
            .unwrap(),
        Mutation::Written
    );
    assert!(!support::raw_entry(&cache, &victim).exists());
    assert!(
        kept.iter()
            .all(|key| support::raw_entry(&cache, key).is_dir())
    );
    let entries = cache
        .storage
        .bundle_records(&cache.root.join("bundles/entries"), 512 * 1024 * 1024)
        .unwrap();
    let stages = cache
        .storage
        .bundle_records(&cache.root.join("bundles/staging"), 512 * 1024 * 1024)
        .unwrap();
    let trash = cache
        .storage
        .bundle_records(&cache.root.join("bundles/trash"), 512 * 1024 * 1024)
        .unwrap();
    let charged = entries
        .iter()
        .chain(stages.iter())
        .chain(trash.iter())
        .map(|record| record.bytes)
        .sum::<u64>();
    assert_eq!(stages.len(), 0);
    assert_eq!(trash.len(), 0);
    assert!(
        charged <= 512 * 1024 * 1024,
        "complete, staged, and retired bytes: {charged}"
    );
}
