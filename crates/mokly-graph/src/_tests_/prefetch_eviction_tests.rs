//! A cache hit at key probing can become a capture render without changing bytes.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::cache::RenderCacheMock;
use crate::collection::ComparisonCollectorMock;
use crate::types::RenderGeneration;

use super::collection_support;

#[test]
fn eviction_after_key_probing_renders_the_missing_input_and_keeps_exact_bytes() {
    let mut probe = collection_support::probe(4);
    collection_support::warm(&probe);
    let first = probe
        .session
        .comparison_input("page-000/index.html")
        .unwrap();
    let key = probe.session.plans()["page-000/index.html"].key.clone();
    let cache = Arc::new(Mutex::new(BTreeMap::from([(key, first.artifact.clone())])));
    let probe_cache = cache.clone();
    let reads = cache.clone();
    let writes = cache.clone();
    Arc::get_mut(&mut probe.session.state).unwrap().cache = Arc::new(Unimock::new((
        RenderCacheMock::contains
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| {
                probe_cache.lock().unwrap().contains_key(key)
            })),
        RenderCacheMock::get
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| {
                reads.lock().unwrap().get(key).cloned()
            })),
        RenderCacheMock::insert
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, key, artifact| {
                writes.lock().unwrap().insert(key, artifact);
            })),
    )));
    assert_eq!(
        probe.session.uncached_documents(),
        [
            "page-001/index.html",
            "page-002/index.html",
            "page-003/index.html"
        ]
    );
    cache.lock().unwrap().clear();
    probe.renders.lock().unwrap().clear();
    let received = Arc::new(Mutex::new(Vec::new()));
    let recorded = received.clone();
    let mut collector = Unimock::new(
        ComparisonCollectorMock::collect
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, route, input| {
                recorded
                    .lock()
                    .unwrap()
                    .push((route.to_owned(), input.document.restore().unwrap().bytes));
                Ok(())
            })),
    );
    let captured = probe.session.collect_comparison(&mut collector);
    assert_eq!(
        captured.as_ref().ok().map(|summary| summary.documents),
        Some(4),
        "capture must reconstruct a view evicted after key probing: {captured:?}"
    );
    assert_eq!(
        received.lock().unwrap()[0],
        ("page-000/index.html".into(), first.artifact.bytes.clone())
    );
    assert_eq!(probe.renders.lock().unwrap().len(), 4);
}
