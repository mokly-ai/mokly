//! Compact documents survive full-tier pressure within a shared total and ceiling.

use std::sync::Arc;

use mokly_html::composition::Composed;
use mokly_html::fragment::Fragment;
use mokly_html::tree::{Node, element};
use mokly_model::usage::CatalogueUsage;

use crate::cache::{Artifact, CacheStats, MemoryCache, RenderCache, compact_cost, entry_cost};
use crate::document_codec::EncodedView;
use crate::key::NodeKey;

fn node(name: &str) -> NodeKey {
    NodeKey(name.into())
}

pub(super) fn numbered(index: usize) -> NodeKey {
    NodeKey(format!("{index:02}").as_str().into())
}

pub(super) fn total(retained: usize) -> usize {
    retained + retained / 15
}

fn fill(cache: &MemoryCache, value: &Arc<Artifact>, count: usize) {
    for index in 0..count {
        cache.insert(numbered(index), value.clone());
    }
}

pub(super) fn document() -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: b"<p>exact\0raw\xffbytes</p>".repeat(128),
        content_type: "text/html; charset=utf-8".into(),
        fragment: None,
        document: Some(Composed {
            tree: vec![element("p", &[], vec![Node::Text("tree".repeat(512))])],
            usage: CatalogueUsage::Unavailable,
            warnings: vec![],
            resources: vec!["image.svg".into()],
            components: vec!["card".into()],
            links: vec![],
        }),
    })
}

pub(super) fn costs(value: &Artifact) -> (usize, usize) {
    (
        entry_cost(&node("aa"), value),
        compact_cost(&node("aa"), &EncodedView::encode(value).unwrap()),
    )
}

#[test]
fn evicted_documents_restore_exact_bytes_and_tree_and_stay_compact() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = MemoryCache::new(total(full * 45 + compact), compact);
    cache.insert(node("aa"), value.clone());
    fill(&cache, &value, 44);
    cache.insert(node("bb"), value.clone());
    assert!(cache.get(&node("zz")).is_none());
    for _ in 0..2 {
        let restored = cache.get(&node("aa"));
        assert!(restored.is_some(), "the evicted document must restore");
        let restored = restored.unwrap();
        assert_eq!(restored.bytes, value.bytes);
        assert_eq!(restored.content_type, value.content_type);
        let before = value.document.as_ref().unwrap();
        let after = restored.document.as_ref().unwrap();
        assert_eq!(after.tree, before.tree);
        assert_eq!(after.usage, before.usage);
        assert_eq!(after.resources, before.resources);
        assert_eq!(after.components, before.components);
        assert!(!Arc::ptr_eq(&restored, &value));
        for _ in 0..45 {
            assert!(Arc::ptr_eq(&cache.get(&node("bb")).unwrap(), &value));
        }
    }
    assert_eq!(
        cache.stats(),
        CacheStats {
            bytes: full * 45 + compact,
            entries: 46,
            hits: 92,
            restores: 2,
            restore_failures: 0,
            misses: 1,
            evictions: 0,
        }
    );
}

#[test]
fn full_eviction_drops_fragments_and_stylesheets() {
    for fragment in [None, Some(Fragment::default())] {
        let value = Arc::new(Artifact {
            bytes: b"resource".to_vec(),
            document: None,
            fragment,
            content_type: "text/css".into(),
        });
        let cache = MemoryCache::new(total(entry_cost(&node("a"), &value)), 16 * 1024);
        cache.insert(node("a"), value.clone());
        cache.insert(node("b"), value.clone());
        assert!(cache.get(&node("a")).is_none());
        assert!(Arc::ptr_eq(&cache.get(&node("b")).unwrap(), &value));
        assert_eq!(cache.stats().evictions, 1);
        assert_eq!(cache.stats().entries, 1);
        assert_eq!(cache.stats().restores, 0);
    }
}

#[test]
fn compact_lru_drops_the_oldest_access_and_counts_only_final_evictions() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = MemoryCache::new(total(full * 45 + compact * 2), compact * 2);
    for name in ["aa", "bb"] {
        cache.insert(node(name), value.clone());
    }
    fill(&cache, &value, 43);
    for name in ["cc", "dd"] {
        cache.insert(node(name), value.clone());
    }
    let restored = cache.get(&node("aa"));
    assert!(
        restored.is_some(),
        "the oldest compact document must still exist"
    );
    assert_eq!(restored.unwrap().bytes, value.bytes);
    cache.insert(node("ee"), value.clone());
    assert!(cache.get(&node("bb")).is_none());
    for _ in 0..45 {
        assert!(Arc::ptr_eq(&cache.get(&node("ee")).unwrap(), &value));
    }
    for name in ["aa", "cc", "dd", "ee"] {
        assert_eq!(cache.get(&node(name)).unwrap().bytes, value.bytes);
    }
    assert_eq!(cache.get(&numbered(0)).unwrap().bytes, value.bytes);
    assert_eq!(
        cache.stats(),
        CacheStats {
            bytes: full * 45 + compact * 2,
            entries: 47,
            hits: 51,
            restores: 3,
            restore_failures: 0,
            misses: 1,
            evictions: 1,
        }
    );
}

#[test]
fn the_total_and_compact_ceiling_hold_and_oversized_compact_entries_leave() {
    let value = document();
    let (full, compact) = costs(&value);
    let bound = total(full * 45 + compact * 2);
    let cache = MemoryCache::new(bound, compact * 2);
    for index in 0..51 {
        cache.insert(numbered(index), value.clone());
        let state = cache.state.lock().unwrap();
        assert!(state.full.bytes + state.compact.bytes + state.transit.bytes <= bound);
        assert_eq!(state.transit.bytes, 0);
        assert!(state.full.bytes <= state.full.bound);
        assert!(state.compact.bytes <= compact * 2);
    }
    assert_eq!(cache.stats().entries, 47);
    assert_eq!(cache.stats().bytes, full * 45 + compact * 2);
    assert_eq!(cache.stats().evictions, 4);
    let cache = MemoryCache::new(total(full * 45 + compact - 1), compact - 1);
    cache.insert(node("aa"), value.clone());
    fill(&cache, &value, 44);
    cache.insert(node("bb"), value);
    assert!(cache.get(&node("aa")).is_none());
    assert_eq!(cache.stats().entries, 45);
    assert_eq!(cache.stats().bytes, full * 45);
    assert_eq!(cache.stats().evictions, 1);
}

#[test]
fn failed_compact_restore_removes_the_entry_and_counts_a_miss() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = MemoryCache::new(total(full * 45 + compact), compact);
    cache.insert(node("aa"), value.clone());
    fill(&cache, &value, 44);
    cache.insert(node("bb"), value.clone());
    let mut encoded = EncodedView::encode(&value).unwrap();
    encoded.invalidate_payload();
    let cost = compact_cost(&node("aa"), &encoded);
    cache
        .state
        .lock()
        .unwrap()
        .compact
        .insert(node("aa"), Arc::new(encoded), cost);
    let (restored, events) = cache_failure_events::capture(|| cache.get(&node("aa")));
    assert!(restored.is_none());
    assert_eq!(
        events,
        [(
            tracing::Level::ERROR,
            vec![(
                "message".into(),
                "render cache document restore failed".into()
            )]
        )]
    );
    assert_eq!(
        cache.stats(),
        CacheStats {
            bytes: full * 45,
            entries: 45,
            hits: 0,
            restores: 0,
            restore_failures: 1,
            misses: 1,
            evictions: 1,
        }
    );
    assert!(cache.get(&node("aa")).is_none());
    assert_eq!(cache.stats().misses, 2);
    assert_eq!(cache.stats().evictions, 1);
}

#[test]
fn reinserting_a_compact_key_keeps_it_compact() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = MemoryCache::new(total(full * 45 + compact * 2), compact * 2);
    cache.insert(node("aa"), value.clone());
    fill(&cache, &value, 44);
    cache.insert(node("bb"), value.clone());
    let restored = cache.get(&node("aa")).unwrap();
    cache.insert(node("aa"), restored);
    {
        let state = cache.state.lock().unwrap();
        assert!(state.compact.contains(&node("aa")));
        assert!(!state.full.contains(&node("aa")));
    }
    for _ in 0..45 {
        assert!(Arc::ptr_eq(&cache.get(&node("bb")).unwrap(), &value));
    }
    let restored = cache.get(&node("aa")).unwrap();
    assert!(!Arc::ptr_eq(&restored, &value));
    assert_eq!(cache.stats().restores, 2);
    assert!(Arc::ptr_eq(&cache.get(&node("bb")).unwrap(), &value));
    assert_eq!(cache.stats().entries, 46);
    assert_eq!(cache.stats().bytes, full * 45 + compact);
    assert_eq!(cache.stats().evictions, 0);
}

#[path = "cache_failure_events.rs"]
mod cache_failure_events;
