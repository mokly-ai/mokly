//! Transit headroom bounds one insert and keeps pending documents readable.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, Weak};

use unimock::{MockFn, Unimock, matching};

use crate::cache::{Artifact, MemoryCache, RenderCache, compact_cost, entry_cost};
use crate::cache_encoding::EncoderMock;
use crate::document_codec::EncodedView;
use crate::document_error::{CodecInternalError, Result};
use crate::key::NodeKey;

use super::compact_cache_tests::{document, total};

fn node(index: usize) -> NodeKey {
    NodeKey(format!("{index:02}").as_str().into())
}

fn cache_with_encoder(
    total: usize,
    ceiling: usize,
    encode: impl Fn(&MemoryCache, &Artifact) -> Result<EncodedView> + Send + Sync + 'static,
) -> Arc<MemoryCache> {
    Arc::new_cyclic(|cache: &Weak<MemoryCache>| {
        let cache = cache.clone();
        MemoryCache {
            encoder: Arc::new(Unimock::new(
                EncoderMock::encode
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, artifact| {
                        encode(&cache.upgrade().unwrap(), artifact)
                    }))
                    .at_least_times(0),
            )),
            ..MemoryCache::new(total, ceiling)
        }
    })
}

fn pressure(cache: &MemoryCache, value: &Arc<Artifact>, full: usize, compact: usize) -> usize {
    for index in 0..90 {
        cache.insert(node(index), value.clone());
    }
    let mut replacement = value.as_ref().clone();
    replacement.bytes = vec![b'x'; value.bytes.len() + full * 88 + compact * 2];
    let cost = entry_cost(&NodeKey("zz".into()), &replacement);
    assert_eq!(cost, full * 89 + compact * 2);
    cache.insert(NodeKey("zz".into()), Arc::new(replacement));
    cost
}

#[test]
fn one_insert_reserves_only_the_documents_that_fit_in_transit_headroom() {
    let value = document();
    let full = entry_cost(&NodeKey("00".into()), &value);
    let compact = compact_cost(&NodeKey("00".into()), &EncodedView::encode(&value).unwrap());
    assert!(compact * 4 < full);
    let total = full * 96;
    let observations = Arc::new(Mutex::new(Vec::new()));
    let captured = observations.clone();
    let cache = cache_with_encoder(total, compact * 2, move |cache, artifact| {
        let stats = cache.stats();
        assert!(stats.bytes <= total, "full + compact + transit must fit");
        captured.lock().unwrap().push(stats);
        EncodedView::encode(artifact)
    });
    let replacement = pressure(&cache, &value, full, compact);
    assert_eq!(cache.stats().evictions, 88);
    let observations = observations.lock().unwrap();
    assert_eq!(
        observations.len(),
        2,
        "only two documents can reserve 3x their charge"
    );
    assert_eq!(observations[0].bytes, replacement + full * 6);
    assert_eq!(observations[0].entries, 3);
    assert_eq!(observations[1].bytes, replacement + full * 3 + compact);
    assert_eq!(observations[1].entries, 3);
    for name in ["00", "01"] {
        let restored = cache.get(&NodeKey(name.into())).unwrap();
        assert_eq!(restored.bytes, value.bytes);
        assert_eq!(
            restored.document.as_ref().unwrap().tree,
            value.document.as_ref().unwrap().tree
        );
        assert!(!Arc::ptr_eq(&restored, &value));
    }
    for index in 2..90 {
        assert!(cache.get(&node(index)).is_none());
    }
    assert_eq!(cache.stats().entries, 3);
    assert_eq!(cache.stats().bytes, replacement + compact * 2);
    assert_eq!(cache.stats().restores, 2);
    assert_eq!(cache.stats().misses, 88);
    assert_eq!(cache.stats().evictions, 88);
}

#[test]
fn a_lookup_during_encoding_returns_the_document_in_transit() {
    let value = document();
    let full = entry_cost(&NodeKey("00".into()), &value);
    let compact = compact_cost(&NodeKey("00".into()), &EncodedView::encode(&value).unwrap());
    let observations = Arc::new(Mutex::new(0));
    let captured = observations.clone();
    let cache = cache_with_encoder(full * 96, compact * 2, move |cache, artifact| {
        let mut count = captured.lock().unwrap();
        let key = node(*count);
        let found = cache.get(&key);
        assert!(
            found.is_some(),
            "a document being encoded must remain readable"
        );
        let found = found.unwrap();
        assert!(std::ptr::eq(found.as_ref(), artifact));
        let before = cache.stats();
        cache.insert(key, found);
        assert_eq!(
            cache.stats(),
            before,
            "reinsertion must keep the transit entry"
        );
        assert_eq!(before.misses, 0);
        assert_eq!(before.restores, 0);
        *count += 1;
        EncodedView::encode(artifact)
    });
    pressure(&cache, &value, full, compact);
    assert_eq!(*observations.lock().unwrap(), 2);
    assert_eq!(cache.stats().hits, 2);
    assert_eq!(cache.stats().misses, 0);
    assert_eq!(cache.stats().restores, 0);
}

#[test]
fn failed_encoding_releases_headroom_for_the_next_compaction() {
    let value = document();
    let full = entry_cost(&node(0), &value);
    let compact = compact_cost(&node(0), &EncodedView::encode(&value).unwrap());
    let calls = AtomicUsize::new(0);
    let cache = cache_with_encoder(total(full * 45 + compact), compact, move |_, artifact| {
        if calls.fetch_add(1, Ordering::Relaxed) == 0 {
            return Err(CodecInternalError::InvalidTree.into());
        }
        EncodedView::encode(artifact)
    });
    for index in 0..46 {
        cache.insert(node(index), value.clone());
    }
    assert_eq!(cache.stats().bytes, full * 45);
    assert_eq!(cache.stats().entries, 45);
    assert_eq!(cache.stats().evictions, 1);
    assert!(cache.get(&node(0)).is_none());
    cache.insert(node(46), value.clone());
    let restored = cache.get(&node(1)).unwrap();
    assert_eq!(restored.bytes, value.bytes);
    assert!(!Arc::ptr_eq(&restored, &value));
    assert_eq!(cache.stats().bytes, full * 45 + compact);
    assert_eq!(cache.stats().entries, 46);
    assert_eq!(cache.stats().evictions, 1);
    assert_eq!(cache.stats().restores, 1);
}
