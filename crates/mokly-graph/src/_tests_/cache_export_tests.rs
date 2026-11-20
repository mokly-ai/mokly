//! Export holds memory charges without changing public cache access semantics.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use crate::cache::{MemoryCache, RenderCache, entry_cost};
use crate::cache_export::{CacheOperation, EncodedConsumer};
use crate::document_codec::EncodedView;
use crate::document_error::CodecInternalError;
use crate::key::NodeKey;

use super::cache_transit_tests::cache_with_encoder;
use super::compact_cache_tests::{costs, document, memory_cache, numbered, total};

struct Export {
    bytes: Option<Vec<u8>>,
}
impl EncodedConsumer for Export {
    fn consume(&mut self, value: &EncodedView) {
        self.bytes = Some(value.restore().unwrap().bytes);
    }
}

#[test]
fn cached_export_keeps_hits_and_access_order_unchanged() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = memory_cache(total(full * 45 + compact), compact);
    let key = NodeKey("aa".into());
    cache.insert(key.clone(), value.clone());
    for index in 0..44 {
        cache.insert(numbered(index), value.clone());
    }
    let before = cache.stats();
    let mut export = Export { bytes: None };
    assert!(
        cache.with_encoded(&key, &mut export),
        "retained document must export under headroom"
    );
    assert_eq!(export.bytes, Some(value.bytes.clone()));
    let after = cache.stats();
    assert_eq!(after.hits, before.hits);
    assert_eq!(after.restores, before.restores);
    assert_eq!(after.misses, before.misses);
    assert_eq!(after.evictions, before.evictions);
    assert_eq!(after.entries, before.entries);
    assert!(after.bytes <= 16 * 1024 * 1024);
    cache.insert(NodeKey("bb".into()), value.clone());
    let restored = cache.get(&key).unwrap();
    assert!(
        !Arc::ptr_eq(&restored, &value),
        "export must leave A oldest, so pressure compacts it"
    );
    assert_eq!(cache.stats().restores, 1);
}

#[test]
fn compact_export_uses_no_restore_promotion_or_encoder_workspace() {
    let value = document();
    let (full, compact) = costs(&value);
    let cache = memory_cache(total(full * 45 + compact), compact);
    let key = NodeKey("aa".into());
    cache.insert(key.clone(), value.clone());
    for index in 0..44 {
        cache.insert(numbered(index), value.clone());
    }
    cache.insert(NodeKey("bb".into()), value.clone());
    let before = cache.stats();
    let mut export = Export { bytes: None };
    assert!(cache.with_encoded(&key, &mut export));
    assert_eq!(export.bytes, Some(value.bytes.clone()));
    assert_eq!(cache.stats(), before);
}

#[test]
fn failed_encoding_releases_its_export_charge_and_encoder_lease() {
    let value = document();
    let full = entry_cost(&NodeKey("aa".into()), &value);
    let calls = Arc::new(AtomicUsize::new(0));
    let counted = calls.clone();
    let cache = cache_with_encoder(full * 512, full * 64, 0, move |cache, value| {
        assert!(cache.stats().bytes <= full * 512);
        if counted.fetch_add(1, Ordering::SeqCst) == 0 {
            return Err(CodecInternalError::InvalidLength.into());
        }
        EncodedView::encode(value)
    });
    let key = NodeKey("aa".into());
    cache.insert(key.clone(), value.clone());
    let before = cache.stats();
    let mut export = Export { bytes: None };
    assert!(!cache.with_encoded(&key, &mut export));
    assert_eq!(export.bytes, None);
    assert_eq!(cache.stats(), before);
    assert!(cache.with_encoded(&key, &mut export));
    assert_eq!(export.bytes, Some(value.bytes.clone()));
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(cache.stats(), before);
}

#[test]
fn active_exports_exhaust_encoder_leases_without_waiting_and_then_release_them() {
    let value = document();
    let full = entry_cost(&NodeKey("aa".into()), &value);
    let calls = Arc::new(AtomicUsize::new(0));
    let counted = calls.clone();
    let cache = cache_with_encoder(full * 512, full * 64, 0, move |cache, value| {
        let count = counted.fetch_add(1, Ordering::SeqCst);
        if count < 8 {
            let mut export = Export { bytes: None };
            assert_eq!(
                cache.with_encoded(&NodeKey("aa".into()), &mut export),
                count < 7
            );
        }
        EncodedView::encode(value)
    });
    let key = NodeKey("aa".into());
    cache.insert(key.clone(), value.clone());
    let before = cache.stats();
    let mut export = Export { bytes: None };
    assert!(cache.with_encoded(&key, &mut export));
    assert_eq!(calls.load(Ordering::SeqCst), 8);
    assert_eq!(cache.stats(), before);
    assert!(cache.with_encoded(&key, &mut export));
    assert_eq!(calls.load(Ordering::SeqCst), 9);
    assert_eq!(cache.stats(), before);
}

struct Workspace<'a> {
    cache: &'a MemoryCache,
    observed: usize,
}
impl CacheOperation for Workspace<'_> {
    fn run(&mut self) {
        self.observed = self.cache.stats().bytes;
    }
}

#[test]
fn writer_workspace_is_charged_and_released_inside_the_existing_bound() {
    let cache = Arc::new(MemoryCache::new(16 * 1024, 0));
    let mut workspace = Workspace {
        cache: &cache,
        observed: 0,
    };
    assert!(
        cache.with_workspace(512, &mut workspace),
        "writer scratch must reserve available headroom"
    );
    assert_eq!(workspace.observed, 512);
    assert_eq!(cache.stats().bytes, 0);
    assert!(!cache.with_workspace(1025, &mut workspace));
    assert_eq!(cache.stats().bytes, 0);
}
