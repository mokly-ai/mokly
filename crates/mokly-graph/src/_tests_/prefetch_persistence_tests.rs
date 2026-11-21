//! Early work probes persistent identities and keeps fresh documents available to writes.

use std::sync::{Arc, Mutex, mpsc};

use mokly_catalogue::render_sources::RenderSource;
use unimock::{MockFn, Unimock, matching};

use crate::cache::{MemoryCache, RenderCache};
use crate::collection::ComparisonCollectorMock;
use crate::document_store::{DocumentStoreMock, OfferOutcome, Persistence, ReadOutcome, StoreKey};
use crate::types::RenderGeneration;
use crate::workers::RenderWorkersMock;

use super::{collection_support, persistent_session_tests};

fn completed_prefetch(probe: &mut collection_support::Probe) -> mpsc::Receiver<()> {
    let (completed, receive) = mpsc::channel();
    Arc::get_mut(&mut probe.session.state).unwrap().workers = Arc::new(Unimock::new((
        RenderWorkersMock::cancelled
            .each_call(matching!())
            .returns(false),
        RenderWorkersMock::prefetch_tasks
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, count, task| {
                for index in 0..count {
                    task.run(index);
                }
                completed.send(()).unwrap();
            })),
    )));
    receive
}

#[test]
fn stored_documents_are_not_listed_or_started_as_early_misses() {
    let mut probe = collection_support::probe(2);
    collection_support::warm(&probe);
    let known = StoreKey::new(
        &probe.session.plans()["page-000/index.html"].key,
        "12:native-build-js-build",
    );
    let loaded = Arc::new(Mutex::new(Vec::new()));
    let reads = loaded.clone();
    let saved = persistent_session_tests::artifact();
    let stored = known.clone();
    let indexed = known;
    let state = Arc::get_mut(&mut probe.session.state).unwrap();
    for route in ["page-000", "page-001"] {
        Arc::make_mut(&mut state.catalogue)
            .javascript
            .entries
            .insert(route.into(), RenderSource::default());
    }
    state.inputs.persistence = Some(Persistence {
        javascript: Some("-js-build".into()),
        store: Arc::new(Unimock::new((
            DocumentStoreMock::identity
                .each_call(matching!())
                .returns(Some("native-build".into())),
            DocumentStoreMock::contains
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| key == &indexed)),
            DocumentStoreMock::load
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| {
                    reads.lock().unwrap().push(key.clone());
                    if key == &stored {
                        ReadOutcome::Hit(saved.clone())
                    } else {
                        ReadOutcome::Miss
                    }
                }))
                .at_least_times(0),
        ))),
    });
    assert_eq!(probe.session.uncached_documents(), ["page-001/index.html"]);
    assert_eq!(*loaded.lock().unwrap(), Vec::<StoreKey>::new());
    let completed = completed_prefetch(&mut probe);
    let guard = probe.session.prefetch_comparison().unwrap();
    assert!(guard.is_some());
    completed.recv().unwrap();
    {
        let _guard = guard;
    }
    assert_eq!(*probe.renders.lock().unwrap(), ["page-001"]);
    assert_eq!(
        *loaded.lock().unwrap(),
        [StoreKey::new(
            &probe.session.plans()["page-001/index.html"].key,
            "12:native-build-js-build"
        )]
    );
}

#[test]
fn early_documents_are_offered_after_validation_with_cache_charges_intact() {
    let mut probe = collection_support::probe(1);
    collection_support::warm(&probe);
    let completed = completed_prefetch(&mut probe);
    let cache = Arc::new(MemoryCache::new(16 * 1024 * 1024, 0));
    let offers = Arc::new(Mutex::new(Vec::new()));
    let offered = offers.clone();
    let state = Arc::get_mut(&mut probe.session.state).unwrap();
    state.cache = cache.clone();
    state.inputs.persistence = Some(Persistence {
        javascript: None,
        store: Arc::new(Unimock::new((
            DocumentStoreMock::identity
                .each_call(matching!())
                .returns(Some("native-build".into())),
            DocumentStoreMock::load
                .each_call(matching!(_))
                .answers(&|_, _| ReadOutcome::Miss),
            DocumentStoreMock::offer
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, key, document| {
                    offered.lock().unwrap().push((key, document));
                    OfferOutcome::Queued
                }))
                .at_least_times(0),
        ))),
    });
    let guard = probe.session.prefetch_comparison().unwrap();
    assert!(guard.is_some());
    completed.recv().unwrap();
    let before = cache.stats();
    assert_eq!(before.entries, 1);
    assert!(
        before.bytes > 0,
        "an early document must keep its cache charge"
    );
    assert!(offers.lock().unwrap().is_empty());
    let pending = offers.clone();
    let mut collector = Unimock::new(
        ComparisonCollectorMock::collect
            .some_call(matching!("page-000/index.html", _))
            .answers_arc(Arc::new(move |_, _, _| {
                assert!(pending.lock().unwrap().is_empty());
                Ok(())
            })),
    );
    assert_eq!(
        probe
            .session
            .collect_comparison(&mut collector)
            .unwrap()
            .documents,
        1
    );
    {
        let _guard = guard;
    }
    let document = probe.session.plans()["page-000/index.html"].key.clone();
    assert_eq!(
        *offers.lock().unwrap(),
        [(StoreKey::new(&document, "12:native-build"), document)]
    );
    let after = cache.stats();
    assert_eq!(after.entries, before.entries);
    assert_eq!(after.bytes, before.bytes);
    assert_eq!(after.evictions, before.evictions);
    assert_eq!(*probe.renders.lock().unwrap(), ["page-000"]);
}
