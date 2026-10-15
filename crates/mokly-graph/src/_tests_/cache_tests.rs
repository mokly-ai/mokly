//! LRU state uses deterministic operation order and exact charged byte counts.

use std::sync::Arc;

use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use mokly_model::usage::CatalogueUsage;

use crate::cache::{Artifact, MemoryCache, RenderCache, entry_cost};
use crate::key::{NodeKey, NodeKind, key};

fn artifact(text: &str) -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: text.as_bytes().to_vec(),
        document: None,
        fragment: None,
        content_type: "text/plain".into(),
    })
}
fn node(text: &str) -> NodeKey {
    key(NodeKind::Document, &[text.as_bytes()])
}

#[test]
fn lru_evicts_the_oldest_access_and_counts_every_retained_byte() {
    let first = artifact("first");
    let second = artifact("other");
    let third = artifact("third");
    let cost = entry_cost(&node("a"), &first);
    let cache: &dyn RenderCache = &MemoryCache::new(cost * 2);
    cache.insert(node("a"), first);
    cache.insert(node("b"), second);
    assert!(cache.get(&node("a")).is_some());
    cache.insert(node("c"), third);
    assert!(cache.get(&node("b")).is_none());
    assert!(cache.get(&node("a")).is_some());
    assert!(cache.get(&node("c")).is_some());
    assert_eq!(cache.stats().bytes, cost * 2);
    assert_eq!(cache.stats().evictions, 1);
    cache.insert(node("a"), artifact("first"));
    assert_eq!(cache.stats().bytes, cost * 2);
    assert_eq!(cache.stats().entries, 2);
}

#[test]
fn oversized_results_and_zero_bounds_retain_no_partial_artifact() {
    let cache: &dyn RenderCache = &MemoryCache::new(0);
    cache.insert(node("a"), artifact("a"));
    assert!(cache.get(&node("a")).is_none());
    assert_eq!(cache.stats().bytes, 0);
    let value = artifact("small");
    let cache: &dyn RenderCache = &MemoryCache::new(entry_cost(&node("a"), &value));
    cache.insert(node("a"), value);
    cache.insert(node("a"), artifact("oversized"));
    assert!(cache.get(&node("a")).is_none());
    assert_eq!(cache.stats().bytes, 0);
}

#[test]
fn node_keys_keep_domains_input_order_and_boundaries() {
    assert_ne!(
        key(NodeKind::Document, &[b"a", b"bc"]),
        key(NodeKind::Document, &[b"ab", b"c"])
    );
    assert_ne!(
        key(NodeKind::Document, &[b"a", b"b"]),
        key(NodeKind::Document, &[b"b", b"a"])
    );
    assert_ne!(
        key(NodeKind::Document, &[b"a"]),
        key(NodeKind::EntrySource, &[b"a"])
    );
    assert_eq!(
        key(NodeKind::Document, &[b"a"]),
        key(NodeKind::Document, &[b"a"])
    );
}

#[test]
fn equal_keys_with_different_allocations_keep_exact_charges_on_access_and_replacement() {
    let ordinary = node("a");
    let mut expanded = String::with_capacity(1024);
    expanded.push_str(&ordinary.0);
    let expanded = NodeKey(expanded);
    let value = artifact("value");
    let cache: &dyn RenderCache = &MemoryCache::new(8192);
    cache.insert(expanded.clone(), value.clone());
    assert!(cache.get(&ordinary).is_some());
    cache.insert(expanded, value.clone());
    assert!(cache.stats().bytes <= 8192);
    cache.insert(ordinary.clone(), value.clone());
    assert_eq!(cache.stats().bytes, entry_cost(&ordinary, &value));
    assert_eq!(cache.stats().entries, 1);
}

#[test]
fn retained_logical_links_cannot_exceed_the_artifact_budget() {
    let cache: &dyn RenderCache = &MemoryCache::new(32 * 1024);
    let value = Arc::new(Artifact {
        bytes: Vec::new(),
        fragment: None,
        content_type: "text/html".into(),
        document: Some(Composed {
            tree: Vec::new(),
            usage: CatalogueUsage::Ready {
                instances: Vec::new(),
                slots: Vec::new(),
                ranges: Vec::new(),
            },
            warnings: Vec::new(),
            resources: Vec::new(),
            components: Vec::new(),
            links: vec![Reference {
                source_route: "home/index.mobile.html".into(),
                target: "x".repeat(1024 * 1024),
                fragment: None,
            }],
        }),
    });
    cache.insert(node("links"), value.clone());
    assert!(cache.get(&node("links")).is_none());
    assert_eq!(cache.stats().entries, 0);
    assert!(value.document.is_some());
}
