//! Full capacity stays available until pressure; only recent repeated restores promote.

use std::sync::Arc;

use crate::cache::{MemoryCache, RenderCache};
use crate::key::NodeKey;

use super::compact_cache_tests::{costs, document};

#[test]
fn a_fitting_catalogue_keeps_every_artifact_full_until_the_total_overflows() {
    let value = document();
    let (full, _) = costs(&value);
    let cache = MemoryCache::new(full * 4, full * 2);
    for name in ["a", "b", "c", "d"] {
        cache.insert(NodeKey(name.into()), value.clone());
    }
    assert_eq!(cache.stats().bytes, full * 4);
    for name in ["a", "b", "c", "d"] {
        assert!(Arc::ptr_eq(
            &cache.get(&NodeKey(name.into())).unwrap(),
            &value
        ));
    }
    assert_eq!(cache.stats().restores, 0);
    assert_eq!(cache.stats().evictions, 0);
    cache.insert(NodeKey("e".into()), value.clone());
    assert_eq!(cache.stats().entries, 5);
    let restored = cache.get(&NodeKey("a".into()));
    assert!(restored.is_some(), "pressure must retain compact documents");
    assert_eq!(restored.unwrap().bytes, value.bytes);
    assert_eq!(cache.stats().restores, 1);
    let state = cache.state.lock().unwrap();
    assert!(state.full.bound >= full * 2);
    assert!(state.compact.bytes > 0);
    assert!(state.full.bytes + state.compact.bytes <= full * 4);
}

#[test]
fn complete_passes_and_their_following_inserts_do_not_promote_compact_documents() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = MemoryCache::new(full * 2 + compact * 2, compact * 2);
    for name in ["a", "b", "c", "d"] {
        cache.insert(NodeKey(name.into()), value.clone());
    }
    for _ in 0..2 {
        for name in ["a", "b", "c", "d"] {
            let key = NodeKey(name.into());
            let restored = cache.get(&key);
            assert!(restored.is_some(), "every view must remain cached");
            assert_eq!(restored.as_ref().unwrap().bytes, value.bytes);
            cache.insert(key, restored.unwrap());
        }
    }
    assert_eq!(cache.stats().restores, 4);
    assert_eq!(cache.stats().hits, 8);
    assert_eq!(cache.stats().misses, 0);
    assert_eq!(cache.stats().evictions, 0);
    let state = cache.state.lock().unwrap();
    assert_eq!(state.full.len(), 2);
    assert_eq!(state.compact.len(), 2);
}

#[test]
fn only_reuse_within_turnover_promotes_and_later_reads_hit_the_full_tier() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = MemoryCache::new(full * 3 + compact, compact);
    for name in ["a", "b", "c", "d"] {
        cache.insert(NodeKey(name.into()), value.clone());
    }
    let key = NodeKey("a".into());
    let first = cache.get(&key);
    assert!(first.is_some(), "the evicted view must restore");
    cache.insert(key.clone(), first.unwrap());
    assert_eq!(cache.stats().restores, 1);
    assert!(Arc::ptr_eq(
        &cache.get(&NodeKey("b".into())).unwrap(),
        &value
    ));
    assert_eq!(cache.get(&key).unwrap().bytes, value.bytes);
    assert_eq!(cache.stats().restores, 2);
    let promoted = cache.get(&key).unwrap();
    assert_eq!(cache.stats().restores, 3);
    assert!(Arc::ptr_eq(&cache.get(&key).unwrap(), &promoted));
    assert_eq!(cache.stats().restores, 3);
    assert_eq!(cache.stats().hits, 5);
    assert_eq!(cache.stats().evictions, 0);
    assert_eq!(cache.stats().entries, 4);
}
