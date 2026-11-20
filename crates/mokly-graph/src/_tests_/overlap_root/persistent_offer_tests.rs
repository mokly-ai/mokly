//! A frozen store miss keeps root overlap and offers only completed worker output.

use std::collections::BTreeSet;
use std::slice;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_html::composition::ComposerMock;
use mokly_html::fragment::{Fragment, FragmentRendererMock};
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::background::CompletionMock;
use crate::cache::{MemoryCache, RenderCache, RenderCacheMock};
use crate::document_store::{DocumentStoreMock, OfferOutcome, Persistence, ReadOutcome, StoreKey};
use crate::key::NodeKey;
use crate::workers::RenderWorkersMock;

use super::support::{
    background, document, observe_validation, persistent_catalogue, route, session,
};

#[test]
fn fresh_background_completion_offers_the_frozen_key_after_validation_and_cache_insertion() {
    let in_worker = Arc::new(AtomicBool::new(false));
    let events = Arc::new(Mutex::new(Vec::new()));
    let cache = Arc::new(MemoryCache::new(1 << 20, 0));
    let reads = Arc::new(AtomicUsize::new(0));
    let identities = Arc::new(AtomicUsize::new(0));
    let insertions = Arc::new(Mutex::new(Vec::new()));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let events = events.clone();
                let cache = cache.clone();
                move |_, _| {
                    assert!(!in_worker.load(Ordering::SeqCst));
                    assert_eq!(cache.stats().misses, 2);
                    events.lock().unwrap().push("root");
                    Ok(Fragment {
                        html: document("<p>Fresh</p>"),
                        resources: vec!["asset.bin".into()],
                        ..Default::default()
                    })
                }
            })),
    )
    .no_verify_in_drop();
    let (mut session, _) = session(
        persistent_catalogue(),
        Arc::new(provider.clone()),
        cache.clone(),
    );
    assert!(session.background_root_eligible(&route("caller")));
    observe_validation(&mut session, in_worker.clone(), events.clone());
    let actual = session.state.composer.clone();
    let composer = Unimock::new((
        ComposerMock::can_prepare_root
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let actual = actual.clone();
                move |_, catalogue, entry| actual.can_prepare_root(catalogue, entry)
            })),
        ComposerMock::prepare_root
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let actual = actual.clone();
                move |_, request| actual.prepare_root(request)
            })),
        ComposerMock::compose_prepared
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let actual = actual.clone();
                let in_worker = in_worker.clone();
                let events = events.clone();
                move |_, request, prepared| {
                    assert!(in_worker.load(Ordering::SeqCst));
                    events.lock().unwrap().push("compose");
                    actual.compose_prepared(request, prepared)
                }
            })),
        ComposerMock::compose
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let actual = actual.clone();
                let events = events.clone();
                move |_, request| {
                    events.lock().unwrap().push("ordinary-compose");
                    actual.compose(request)
                }
            })),
    ))
    .no_verify_in_drop();
    let loads = Arc::new(Mutex::new(Vec::<StoreKey>::new()));
    let offers = Arc::new(Mutex::new(Vec::new()));
    let closures = session.state.inputs.closures.clone();
    let store = Unimock::new((
        DocumentStoreMock::identity
            .each_call(matching!())
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let identities = identities.clone();
                move |_| {
                    assert!(in_worker.load(Ordering::SeqCst));
                    identities.fetch_add(1, Ordering::SeqCst);
                    Some("native-build".into())
                }
            })),
        DocumentStoreMock::load
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let events = events.clone();
                let loads = loads.clone();
                move |_, key| {
                    events.lock().unwrap().push("load");
                    loads.lock().unwrap().push(key.clone());
                    ReadOutcome::Miss
                }
            })),
        DocumentStoreMock::offer
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let events = events.clone();
                let offers = offers.clone();
                let insertions = insertions.clone();
                move |_, key, document| {
                    assert!(in_worker.load(Ordering::SeqCst));
                    assert!(events.lock().unwrap().contains(&"validate"));
                    assert_eq!(
                        insertions.lock().unwrap().as_slice(),
                        slice::from_ref(&document)
                    );
                    assert_eq!(
                        closures.paths(&document.0),
                        BTreeSet::from(["asset.bin".into()])
                    );
                    events.lock().unwrap().push("offer");
                    offers.lock().unwrap().push((key, document));
                    OfferOutcome::Queued
                }
            })),
    ))
    .no_verify_in_drop();
    let document_cache = Unimock::new((
        RenderCacheMock::get
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let cache = cache.clone();
                let reads = reads.clone();
                move |_, key| {
                    reads.fetch_add(1, Ordering::SeqCst);
                    cache.get(key)
                }
            })),
        RenderCacheMock::insert
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let cache = cache.clone();
                let insertions = insertions.clone();
                let events = events.clone();
                move |_, key, artifact| {
                    insertions.lock().unwrap().push(key.clone());
                    events.lock().unwrap().push("insert");
                    cache.insert(key, artifact);
                }
            })),
    ))
    .no_verify_in_drop();
    let workers = Unimock::new((
        RenderWorkersMock::background
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let events = events.clone();
                move |_, route, job| {
                    events.lock().unwrap().push("read-worker");
                    in_worker.store(true, Ordering::SeqCst);
                    let result = job.read(route);
                    in_worker.store(false, Ordering::SeqCst);
                    events.lock().unwrap().push("read-complete");
                    result
                }
            })),
        RenderWorkersMock::document
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let events = events.clone();
                move |_, route, job| {
                    events.lock().unwrap().push("worker");
                    in_worker.store(true, Ordering::SeqCst);
                    let result = job.artifact(route);
                    in_worker.store(false, Ordering::SeqCst);
                    events.lock().unwrap().push("complete");
                    result
                }
            })),
        RenderWorkersMock::comparison_tasks
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let events = events.clone();
                move |_, count, task| {
                    events.lock().unwrap().push("preflight");
                    in_worker.store(true, Ordering::SeqCst);
                    for index in 0..count {
                        task.run(index);
                    }
                    in_worker.store(false, Ordering::SeqCst);
                }
            })),
    ))
    .no_verify_in_drop();
    let completion = Unimock::new((
        CompletionMock::metadata_bytes
            .each_call(matching!())
            .returns(256_usize),
        CompletionMock::handoff
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let events = events.clone();
                move |_, _| {
                    assert!(!in_worker.load(Ordering::SeqCst));
                    events.lock().unwrap().push("handoff");
                }
            })),
    ))
    .no_verify_in_drop();
    let state = Arc::get_mut(&mut session.state).unwrap();
    state.composer = Arc::new(composer.clone());
    state.cache = Arc::new(document_cache.clone());
    state.workers = Arc::new(workers.clone());
    state.inputs.persistence = Some(Persistence {
        store: Arc::new(store.clone()),
        javascript: Some("stable-typescript-react-config".into()),
    });
    assert!(session.background_root_eligible(&route("caller")));
    let trace = Trace::default();
    let artifact = trace
        .in_scope(|| background(&session, &route("caller"), Arc::new(completion.clone())).unwrap());

    assert_eq!(
        offers.lock().unwrap().len(),
        1,
        "BackgroundJob must offer its completed fresh document"
    );
    assert_eq!(loads.lock().unwrap().len(), 1);
    assert_eq!(reads.load(Ordering::SeqCst), 1);
    assert_eq!(identities.load(Ordering::SeqCst), 1);
    assert_eq!(
        *offers.lock().unwrap(),
        [(loads.lock().unwrap()[0].clone(), NodeKey("caller".into()))]
    );
    assert_eq!(
        *events.lock().unwrap(),
        [
            "read-worker",
            "load",
            "read-complete",
            "root",
            "handoff",
            "worker",
            "compose",
            "validate",
            "insert",
            "offer",
            "complete"
        ]
    );
    assert!(
        String::from_utf8(artifact.bytes.clone())
            .unwrap()
            .contains("<p>Fresh</p>")
    );
    assert_eq!(cache.stats().misses, 2);
    assert_eq!(cache.stats().hits, 0);
    assert_eq!(trace.closed("render.document").len(), 1);
}
