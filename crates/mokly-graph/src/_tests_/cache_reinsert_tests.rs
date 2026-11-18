//! Reinserting one full-tier artifact refreshes access without a public cache hit.

use std::sync::Arc;

use crate::cache::{Artifact, MemoryCache, RenderCache, entry_cost};
use crate::key::NodeKey;

#[test]
fn reinserting_the_same_handle_keeps_charge_counts_and_lru_recency() {
    let value = Arc::new(Artifact {
        bytes: b"same".to_vec(),
        document: None,
        fragment: None,
        content_type: "text/plain".into(),
    });
    let first = NodeKey("a".into());
    let cost = entry_cost(&first, &value);
    let retained = cost * 2;
    let cache = MemoryCache::new(retained + retained / 15, 0);
    cache.insert(first.clone(), value.clone());
    cache.insert(NodeKey("b".into()), value.clone());
    let before = cache.stats();
    cache.insert(first.clone(), value.clone());
    assert_eq!(cache.stats(), before);
    assert_eq!(cache.state.lock().unwrap().operations, 3);
    cache.insert(NodeKey("c".into()), value.clone());
    assert_eq!(cache.stats().bytes, retained);
    assert_eq!(cache.stats().entries, 2);
    assert_eq!(cache.stats().evictions, 1);
    assert!(cache.get(&NodeKey("b".into())).is_none());
    assert!(Arc::ptr_eq(&cache.get(&first).unwrap(), &value));
    assert_eq!(cache.stats().hits, 1);
    assert_eq!(cache.stats().misses, 1);
}
