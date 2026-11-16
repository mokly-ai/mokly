//! Full capacity stays available until pressure; only recent repeated restores promote.

use std::sync::Arc;

use crate::cache::{MemoryCache, RenderCache};

use super::compact_cache_tests::{costs, document, numbered, total};

#[test]
fn a_fitting_catalogue_keeps_every_artifact_full_until_retained_capacity_overflows() {
    let value = document();
    let (full, _) = costs(&value);
    let cache = MemoryCache::new(full * 48, full * 24);
    for index in 0..45 {
        cache.insert(numbered(index), value.clone());
    }
    assert_eq!(cache.stats().bytes, full * 45);
    for index in 0..45 {
        assert!(Arc::ptr_eq(&cache.get(&numbered(index)).unwrap(), &value));
    }
    assert_eq!(cache.stats().restores, 0);
    assert_eq!(cache.stats().evictions, 0);
    cache.insert(numbered(45), value.clone());
    assert_eq!(cache.stats().entries, 46);
    let restored = cache.get(&numbered(0));
    assert!(restored.is_some(), "pressure must retain compact documents");
    assert_eq!(restored.unwrap().bytes, value.bytes);
    assert_eq!(cache.stats().restores, 1);
    let state = cache.state.lock().unwrap();
    assert!(state.full.bound >= full * 21);
    assert!(state.compact.bytes > 0);
    assert!(state.full.bytes + state.compact.bytes + state.transit.bytes <= full * 48);
}

#[test]
fn complete_passes_and_their_following_inserts_do_not_promote_compact_documents() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = MemoryCache::new(total(full * 45 + compact * 2), compact * 2);
    for index in 0..47 {
        cache.insert(numbered(index), value.clone());
    }
    for _ in 0..2 {
        for index in 0..47 {
            let key = numbered(index);
            let restored = cache.get(&key);
            assert!(restored.is_some(), "every view must remain cached");
            assert_eq!(restored.as_ref().unwrap().bytes, value.bytes);
            cache.insert(key, restored.unwrap());
        }
    }
    assert_eq!(cache.stats().restores, 4);
    assert_eq!(cache.stats().hits, 94);
    assert_eq!(cache.stats().misses, 0);
    assert_eq!(cache.stats().evictions, 0);
    let state = cache.state.lock().unwrap();
    assert_eq!(state.full.len(), 45);
    assert_eq!(state.compact.len(), 2);
}

#[test]
fn only_reuse_within_turnover_promotes_and_later_reads_hit_the_full_tier() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = MemoryCache::new(total(full * 45 + compact), compact);
    for index in 0..46 {
        cache.insert(numbered(index), value.clone());
    }
    let key = numbered(0);
    let first = cache.get(&key);
    assert!(first.is_some(), "the evicted view must restore");
    cache.insert(key.clone(), first.unwrap());
    assert_eq!(cache.stats().restores, 1);
    for _ in 0..43 {
        assert!(Arc::ptr_eq(&cache.get(&numbered(1)).unwrap(), &value));
    }
    assert_eq!(cache.get(&key).unwrap().bytes, value.bytes);
    assert_eq!(cache.stats().restores, 2);
    let promoted = cache.get(&key).unwrap();
    assert_eq!(cache.stats().restores, 3);
    assert!(Arc::ptr_eq(&cache.get(&key).unwrap(), &promoted));
    assert_eq!(cache.stats().restores, 3);
    assert_eq!(cache.stats().hits, 47);
    assert_eq!(cache.stats().evictions, 0);
    assert_eq!(cache.stats().entries, 46);
}
