//! Presence probes preserve the ordinary cache read and promotion sequence.

use std::sync::Arc;

use crate::cache::{Artifact, MemoryCache, RenderCache};
use crate::key::NodeKey;

use super::compact_cache_tests::{costs, document, memory_cache, numbered, total};

#[test]
fn probes_do_not_count_promote_or_copy_an_existing_entry() {
    let cache = MemoryCache::new(4096, 0);
    let key = NodeKey("held".into());
    let value = Arc::new(Artifact {
        bytes: vec![1; 1000],
        document: None,
        fragment: None,
        content_type: "text/plain".into(),
    });
    cache.insert(key.clone(), value.clone());
    let before = cache.stats();
    for _ in 0..8 {
        assert!(cache.contains(&key));
    }
    assert!(!cache.contains(&NodeKey("absent".into())));
    assert_eq!(cache.stats(), before);
    assert_eq!(Arc::strong_count(&value), 2);
    assert!(Arc::ptr_eq(&cache.get(&key).unwrap(), &value));
    assert_eq!(cache.stats().hits, 1);
    assert_eq!(cache.stats().misses, 0);
    cache.insert(NodeKey("next".into()), value.clone());
    assert!(cache.contains(&key));
    cache.insert(NodeKey("last".into()), value.clone());
    assert!(
        cache.get(&key).is_none(),
        "a presence probe must not refresh LRU order"
    );

    let value = document();
    let (full, compact) = costs(&value);
    let cache = memory_cache(total(full * 45 + compact), compact);
    for index in 0..46 {
        cache.insert(numbered(index), value.clone());
    }
    let key = numbered(0);
    assert_eq!(cache.get(&key).unwrap().bytes, value.bytes);
    let before = cache.stats();
    for _ in 0..64 {
        assert!(cache.contains(&key));
    }
    assert_eq!(cache.stats(), before, "compact probes must not restore");
    let promoted = cache.get(&key).unwrap();
    assert!(
        Arc::ptr_eq(&cache.get(&key).unwrap(), &promoted),
        "probes must not change the turnover operation sequence"
    );
    assert_eq!(cache.stats().restores, 2);
}
