//! A frozen store miss keeps root overlap and offers only completed worker output.

use std::collections::BTreeSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_html::composition::ComposerMock;
use mokly_html::fragment::{Fragment, FragmentRendererMock};
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::background::CompletionMock;
use crate::cache::{MemoryCache, RenderCache};
use crate::document_store::{DocumentStoreMock, OfferOutcome, Persistence, ReadOutcome, StoreKey};
use crate::key::NodeKey;
use crate::types::RenderGeneration;
use crate::workers::RenderWorkersMock;

use super::support::{document, observe_validation, persistent_catalogue, route, session};

#[test]
fn fresh_background_completion_offers_the_frozen_key_after_validation_and_cache_insertion() {
    let in_worker = Arc::new(AtomicBool::new(false));
    let events = Arc::new(Mutex::new(Vec::new()));
    let cache = Arc::new(MemoryCache::new(1 << 20, 0));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let events = events.clone();
                let cache = cache.clone();
                move |_, _| {
                    assert!(!in_worker.load(Ordering::SeqCst));
                    assert_eq!(cache.stats().misses, 1);
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
    assert!(session.can_prepare_root(&route("caller")));
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
    let hints = Arc::new(Mutex::new(Vec::<StoreKey>::new()));
    let loads = Arc::new(Mutex::new(Vec::<StoreKey>::new()));
    let offers = Arc::new(Mutex::new(Vec::new()));
    let closures = session.state.inputs.closures.clone();
    let store = Unimock::new((
        DocumentStoreMock::identity
            .each_call(matching!())
            .returns(Some("native-build".into())),
        DocumentStoreMock::try_miss
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let in_worker = in_worker.clone();
                let events = events.clone();
                let hints = hints.clone();
                move |_, key| {
                    assert!(!in_worker.load(Ordering::SeqCst));
                    events.lock().unwrap().push("hint");
                    hints.lock().unwrap().push(key.clone());
                    true
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
                let cache = cache.clone();
                move |_, key, document| {
                    assert!(in_worker.load(Ordering::SeqCst));
                    assert!(events.lock().unwrap().contains(&"validate"));
                    assert!(cache.contains(&document));
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
    let workers = Unimock::new((
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
    state.workers = Arc::new(workers.clone());
    state.inputs.persistence = Some(Persistence {
        store: Arc::new(store.clone()),
        javascript: Some("stable-typescript-react-config".into()),
    });
    assert!(session.can_prepare_root(&route("caller")));
    let trace = Trace::default();
    let artifact = trace.in_scope(|| {
        session
            .render_background(&route("caller"), Arc::new(completion.clone()))
            .unwrap()
    });

    assert_eq!(
        offers.lock().unwrap().len(),
        1,
        "BackgroundJob must offer its completed fresh document"
    );
    assert_eq!(hints.lock().unwrap().len(), 1);
    assert_eq!(
        *offers.lock().unwrap(),
        [(hints.lock().unwrap()[0].clone(), NodeKey("caller".into()))]
    );
    assert_eq!(*loads.lock().unwrap(), Vec::<StoreKey>::new());
    assert_eq!(
        *events.lock().unwrap(),
        [
            "hint", "root", "handoff", "worker", "compose", "validate", "offer", "complete"
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
