//! Key probing neither restores compact views nor changes cache access order.

use crate::cache::RenderCache;

use super::compact_cache_tests::{costs, document, memory_cache, numbered, total};

#[test]
fn probing_full_and_compact_keys_leaves_statistics_and_eviction_order_unchanged() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = memory_cache(total(full * 45 + compact * 2), compact * 2);
    for index in 0..47 {
        cache.insert(numbered(index), value.clone());
    }
    let before = cache.stats();
    assert!(cache.contains(&numbered(0)), "compact keys must be visible");
    assert!(cache.contains(&numbered(46)), "full keys must be visible");
    assert!(!cache.contains(&numbered(99)));
    assert_eq!(cache.stats(), before);
    cache.insert(numbered(47), value);
    assert!(
        !cache.contains(&numbered(0)),
        "a probe must not refresh LRU order"
    );
    assert!(cache.contains(&numbered(1)));
    assert_eq!(cache.stats().restores, 0);
}
