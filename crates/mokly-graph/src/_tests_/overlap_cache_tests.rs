//! Transient background ownership must evict cache values within the same bound.

use std::sync::Arc;

use crate::cache::{Artifact, MemoryCache, RenderCache};
use crate::key::NodeKey;

#[test]
fn transient_payload_reserves_retained_bytes_and_returns_them_on_drop() {
    let cache = MemoryCache::new(4096, 0);
    let key = NodeKey("old".into());
    cache.insert(
        key.clone(),
        Arc::new(Artifact {
            bytes: vec![1; 2000],
            document: None,
            fragment: None,
            content_type: "text/plain".into(),
        }),
    );
    let lease = cache.reserve(2500);
    assert!(
        lease.is_some(),
        "a payload that fits must displace retained artifacts"
    );
    assert!(cache.get(&key).is_none());
    assert_eq!(cache.stats().bytes, 2500);
    assert!(cache.reserve(1500).is_none());
    drop(lease);
    assert_eq!(cache.stats().bytes, 0);
    assert!(cache.reserve(3841).is_none());
    assert_eq!(cache.stats().bytes, 0);
}

#[test]
fn active_payloads_reduce_later_cache_insert_capacity_without_using_headroom() {
    let cache = MemoryCache::new(4096, 0);
    let lease = cache.reserve(3000).unwrap();
    for index in 0..8 {
        cache.insert(
            NodeKey(format!("entry-{index}")),
            Arc::new(Artifact {
                bytes: Vec::new(),
                document: None,
                fragment: None,
                content_type: "text/plain".into(),
            }),
        );
        assert!(cache.stats().bytes <= 3840);
    }
    assert_eq!(cache.stats().entries, 1);
    assert!(cache.reserve(841).is_none());
    drop(lease);
    cache.insert(
        NodeKey("larger".into()),
        Arc::new(Artifact {
            bytes: vec![2; 2000],
            document: None,
            fragment: None,
            content_type: "text/plain".into(),
        }),
    );
    assert_eq!(cache.stats().entries, 2);
    assert!(cache.stats().bytes <= 3840);
}
