//! Complete memory seeds precede disk and keep installed compilation provenance.

use std::sync::{Arc, Mutex, Weak};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::{BundleStoreMock, WriteOutcome};
use crate::methods::{Call, CssModules};
use crate::pool::{Pool, SidecarPool};
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

use super::{answer, bundle, hit, live, pool, unchanged_hit, worker};

#[test]
fn disk_restores_before_bundle_and_a_hit_keeps_its_existing_record() {
    let events = Arc::new(Mutex::new(vec![]));
    let loaded = events.clone();
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                loaded.lock().unwrap().push("load".into());
                hit("seed")
            })),
        BundleStoreMock::save
            .some_call(matching!(_))
            .returns(WriteOutcome::Unchanged),
    ));
    let pool = pool(store, worker(events.clone(), "seed", 0));
    let result = bundle(&pool);
    assert_eq!(result.cache, Some(CacheOutcome::Hit));
    assert_eq!(result.generation, "seed");
    assert_eq!(
        *events.lock().unwrap(),
        ["load", "restore:disk:seed", "bundle", "dispose:disk:seed"]
    );
}

#[test]
fn complete_memory_is_selected_before_newest_epoch_and_installed_keys_count_as_memory() {
    let events = Arc::new(Mutex::new(vec![]));
    let store = Unimock::new(
        BundleStoreMock::save
            .some_call(matching!(_))
            .returns(WriteOutcome::StoreFault),
    );
    let pool = pool(store, worker(events.clone(), "old", 0));
    live(&pool, "old", 1, true, true);
    live(&pool, "complete", 2, true, false);
    live(&pool, "incomplete", 3, false, false);
    let result = bundle(&pool);
    assert_eq!(
        result.cache,
        Some(CacheOutcome::Memory),
        "save faults cannot replace actual reuse"
    );
    assert_eq!(*events.lock().unwrap(), ["restore:complete", "bundle"]);
}

#[test]
fn incomplete_memory_allows_disk_fallback_and_explicit_old_lease_restoration() {
    let events = Arc::new(Mutex::new(vec![]));
    let pool = pool(unchanged_hit(), worker(events.clone(), "seed", 0));
    live(&pool, "incomplete", 3, false, false);
    assert_eq!(bundle(&pool).cache, Some(CacheOutcome::Hit));
    pool.request(Call::CssModules(CssModules {
        generation: "incomplete".into(),
        named_exports: None,
        class_maps: Default::default(),
    }))
    .unwrap();
    assert_eq!(
        *events.lock().unwrap(),
        [
            "restore:disk:seed",
            "bundle",
            "dispose:disk:seed",
            "restore:incomplete",
            "maps"
        ]
    );
    assert_eq!(
        pool.lock().slots[1].as_ref().unwrap().generations["incomplete"],
        3
    );
}

#[test]
fn an_incomplete_final_release_removes_the_older_complete_recipe_before_disk_fallback() {
    let events = Arc::new(Mutex::new(vec![]));
    let pool = pool(unchanged_hit(), worker(events.clone(), "seed", 0));
    for (id, epoch, complete) in [("complete", 1, true), ("partial", 2, false)] {
        live(&pool, id, epoch, complete, false);
        pool.release_generation(id, epoch);
        pool.synchronize_releases();
    }
    assert_eq!(pool.lock().recipes.len(), 0);
    assert_eq!(bundle(&pool).cache, Some(CacheOutcome::Hit));
    assert_eq!(
        *events.lock().unwrap(),
        ["restore:disk:seed", "bundle", "dispose:disk:seed"]
    );
}

#[test]
fn a_final_lease_release_during_restore_preserves_memory_provenance() {
    let owner: Arc<Mutex<Weak<Pool>>> = Arc::default();
    let restored = owner.clone();
    let worker = Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| match request.call {
                Call::RestoreGeneration(_) => {
                    restored
                        .lock()
                        .unwrap()
                        .upgrade()
                        .unwrap()
                        .release_generation("live", 1);
                    Ok(MethodResult::Empty)
                }
                Call::Bundle(_) => Ok(answer("live", 0)),
                _ => panic!("unexpected request"),
            })),
        WorkerMock::resident_bytes
            .some_call(matching!())
            .returns(Ok(0)),
    ));
    let pool = pool(
        Unimock::new(
            BundleStoreMock::save
                .some_call(matching!(_))
                .returns(WriteOutcome::Written),
        ),
        worker,
    );
    *owner.lock().unwrap() = Arc::downgrade(&pool);
    live(&pool, "live", 1, true, false);
    let result = bundle(&pool);
    assert_eq!(result.cache, Some(CacheOutcome::Memory));
    assert_eq!(result.epoch, 2);
    assert_eq!(pool.lock().leases["live"], [2].into());
}
