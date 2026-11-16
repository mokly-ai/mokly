//! Encoding leases bound overlapping compactions and retain their fixed charge.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use crate::cache::{MemoryCache, RenderCache, compact_cost, entry_cost};
use crate::document_codec::EncodedView;
use crate::document_error::CodecInternalError;
use crate::key::NodeKey;

use super::cache_transit_tests::cache_with_encoder;
use super::compact_cache_tests::{document, total};

fn node(index: usize) -> NodeKey {
    NodeKey(format!("{index:03}").as_str().into())
}

#[test]
fn eight_leases_bound_overlapping_encodes_and_a_saturated_insert_evicts_without_waiting() {
    let value = document();
    let full = entry_cost(&node(0), &value);
    let compact = compact_cost(&node(0), &EncodedView::encode(&value).unwrap());
    let calls = Arc::new(AtomicUsize::new(0));
    let active = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let dropped = Arc::new(AtomicUsize::new(usize::MAX));
    let observed_calls = calls.clone();
    let observed_active = active.clone();
    let observed_peak = peak.clone();
    let observed_dropped = dropped.clone();
    let cache = cache_with_encoder(full * 512, compact * 16, 64, move |cache, artifact| {
        let call = observed_calls.fetch_add(1, Ordering::Relaxed);
        let active = observed_active.fetch_add(1, Ordering::Relaxed) + 1;
        observed_peak.fetch_max(active, Ordering::Relaxed);
        if call < 8 {
            cache.insert(node(481 + call), Arc::new(artifact.clone()));
        }
        if call == 7 {
            observed_dropped.store(cache.stats().evictions, Ordering::Relaxed);
            assert_eq!(observed_active.load(Ordering::Relaxed), 8);
            assert!(cache.get(&node(8)).is_none());
            assert_eq!(cache.stats().bytes, full * 504 + 512);
        }
        observed_active.fetch_sub(1, Ordering::Relaxed);
        EncodedView::encode(artifact)
    });
    for index in 0..480 {
        cache.insert(node(index), value.clone());
    }
    cache.insert(node(480), value);
    assert_eq!(
        peak.load(Ordering::Relaxed),
        8,
        "only eight encodes may overlap"
    );
    assert_eq!(dropped.load(Ordering::Relaxed), 1);
    assert_eq!(active.load(Ordering::Relaxed), 0);
    assert!(cache.stats().bytes <= full * 512);
    assert_eq!(cache.stats().restores, 0);
}

#[test]
fn encoder_workspace_stays_charged_after_success_and_failure() {
    let value = document();
    let full = entry_cost(&node(0), &value);
    let compact = compact_cost(&node(0), &EncodedView::encode(&value).unwrap());
    let calls = AtomicUsize::new(0);
    let cache = cache_with_encoder(
        total(full * 60 + compact * 2),
        compact * 2,
        64,
        move |cache, artifact| {
            let call = calls.fetch_add(1, Ordering::Relaxed);
            assert_eq!(
                cache.stats().bytes,
                full * 63 + call.saturating_sub(1) * compact + 64
            );
            if call == 0 {
                return Err(CodecInternalError::InvalidTree.into());
            }
            EncodedView::encode(artifact)
        },
    );
    for index in 0..61 {
        cache.insert(node(index), value.clone());
    }
    assert_eq!(cache.stats().bytes, full * 60 + 64);
    assert_eq!(cache.stats().evictions, 1);
    cache.insert(node(61), value.clone());
    assert_eq!(cache.stats().bytes, full * 60 + compact + 64);
    assert_eq!(cache.stats().evictions, 1);
    assert_eq!(cache.stats().entries, 61);
    cache.insert(node(62), value);
    assert_eq!(cache.stats().bytes, full * 60 + compact * 2 + 64);
    assert_eq!(cache.stats().evictions, 1);
    assert_eq!(cache.stats().entries, 62);
}

#[test]
fn fixed_workspace_must_fit_before_a_document_can_compact() {
    let value = document();
    let full = entry_cost(&node(0), &value);
    let compact = compact_cost(&node(0), &EncodedView::encode(&value).unwrap());
    let cache = MemoryCache::new(full * 48, compact);
    for index in 0..46 {
        cache.insert(node(index), value.clone());
    }
    assert_eq!(cache.stats().bytes, full * 45);
    assert_eq!(cache.stats().entries, 45);
    assert_eq!(cache.stats().evictions, 1);
    assert!(cache.get(&node(0)).is_none());
}
