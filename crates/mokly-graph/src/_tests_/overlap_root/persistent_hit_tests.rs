//! Stored JavaScript views record their inputs without preparing a sidecar root.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::composition::Composed;
use mokly_html::fragment::{Fragment, FragmentRendererMock, FragmentRequest, RenderKind};
use mokly_html::parse;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::usage::CatalogueUsage;
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::cache::{Artifact, MemoryCache, RenderCache};
use crate::document_store::{DocumentStoreMock, OfferOutcome, Persistence, ReadOutcome, StoreKey};
use crate::key::NodeKey;
use crate::workers::RenderWorkersMock;

use super::support::{
    background, completion, document, observe_validation, persistent_catalogue, route, session,
};

#[test]
fn stored_background_views_record_served_inputs_without_root_render_or_handoff() {
    for with_fault in [false, true] {
        let in_worker = Arc::new(AtomicBool::new(false));
        let events = Arc::new(Mutex::new(Vec::new()));
        let roots = Arc::new(AtomicUsize::new(0));
        let served = Arc::new(Mutex::new(Vec::new()));
        let provider = Unimock::new((
            FragmentRendererMock::render
                .each_call(matching!(_))
                .answers_arc(Arc::new({
                    let roots = roots.clone();
                    move |_, _| {
                        roots.fetch_add(1, Ordering::SeqCst);
                        Ok(Fragment {
                            html: document("<p>Unexpected render</p>"),
                            ..Default::default()
                        })
                    }
                })),
            FragmentRendererMock::record_served
                .each_call(matching!(_))
                .answers_arc(Arc::new({
                    let in_worker = in_worker.clone();
                    let events = events.clone();
                    let served = served.clone();
                    move |_, request| {
                        assert!(in_worker.load(Ordering::SeqCst));
                        events.lock().unwrap().push("served");
                        served.lock().unwrap().push(request.clone());
                    }
                })),
        ))
        .no_verify_in_drop();
        let saved = Arc::new(Artifact {
            bytes: b"exact stored background bytes\0\xff".to_vec(),
            content_type: "text/html; charset=utf-8".into(),
            fragment: None,
            document: Some(Composed {
                tree: parse::html(DeliveredHtml::document(&document("<p>Stored</p>"))),
                usage: CatalogueUsage::Unavailable,
                warnings: vec![],
                resources: vec!["asset.bin".into()],
                components: vec![],
                links: vec![],
            }),
        });
        let loads = Arc::new(Mutex::new(Vec::new()));
        let offers = Arc::new(AtomicUsize::new(0));
        let store = Unimock::new((
            DocumentStoreMock::identity
                .each_call(matching!())
                .returns(Some("native-build".into())),
            DocumentStoreMock::load
                .each_call(matching!(_))
                .answers_arc(Arc::new({
                    let in_worker = in_worker.clone();
                    let events = events.clone();
                    let loads = loads.clone();
                    let saved = saved.clone();
                    move |_, key| {
                        assert!(in_worker.load(Ordering::SeqCst));
                        events.lock().unwrap().push("load");
                        loads.lock().unwrap().push(key.clone());
                        if with_fault {
                            ReadOutcome::HitWithStoreFault(saved.clone())
                        } else {
                            ReadOutcome::Hit(saved.clone())
                        }
                    }
                })),
            DocumentStoreMock::offer
                .each_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let offers = offers.clone();
                    move |_, _, _| {
                        offers.fetch_add(1, Ordering::SeqCst);
                        OfferOutcome::Queued
                    }
                })),
        ))
        .no_verify_in_drop();
        let workers = Unimock::new(
            RenderWorkersMock::background
                .each_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let in_worker = in_worker.clone();
                    let events = events.clone();
                    move |_, route, job| {
                        events.lock().unwrap().push("worker");
                        in_worker.store(true, Ordering::SeqCst);
                        let result = job.read(route);
                        in_worker.store(false, Ordering::SeqCst);
                        events.lock().unwrap().push("complete");
                        result
                    }
                })),
        )
        .no_verify_in_drop();
        let cache = Arc::new(MemoryCache::new(1 << 20, 0));
        let (mut session, _) = session(
            persistent_catalogue(),
            Arc::new(provider.clone()),
            cache.clone(),
        );
        observe_validation(&mut session, in_worker.clone(), events.clone());
        let state = Arc::get_mut(&mut session.state).unwrap();
        state.workers = Arc::new(workers.clone());
        state.inputs.persistence = Some(Persistence {
            store: Arc::new(store.clone()),
            javascript: Some("stable-typescript-react-config".into()),
        });
        assert!(session.background_root_eligible(&route("caller")));
        let (completion, counts) = completion();
        let trace = Trace::default();
        let actual = trace.in_scope(|| {
            background(&session, &route("caller"), Arc::new(completion.clone())).unwrap()
        });

        assert_eq!(roots.load(Ordering::SeqCst), 0, "with_fault={with_fault}");
        assert_eq!(counts.handed.load(Ordering::SeqCst), 0);
        assert_eq!(counts.metadata.load(Ordering::SeqCst), 0);
        assert_eq!(
            actual.bytes,
            b"exact stored background bytes\0\xff".to_vec()
        );
        assert_eq!(actual.content_type, "text/html; charset=utf-8");
        assert_eq!(
            *served.lock().unwrap(),
            [FragmentRequest {
                handle: "caller.recipe#page".into(),
                entry_path: "caller".into(),
                entry_title: "Test".into(),
                kind: RenderKind::Page,
                props: Default::default(),
                viewport: Viewport::Desktop,
                color_scheme: ColorScheme::Light,
                ignore_enabled: true,
                slots: BTreeMap::new(),
                saved_slots: BTreeMap::new(),
            }]
        );
        assert_eq!(offers.load(Ordering::SeqCst), 0);
        assert_eq!(*session.state.fresh.lock().unwrap(), BTreeMap::new());
        assert_eq!(loads.lock().unwrap().len(), 1);
        assert_eq!(
            *loads.lock().unwrap(),
            [StoreKey::new(
                &NodeKey("caller".into()),
                "12:native-buildstable-typescript-react-config"
            )]
        );
        assert_eq!(
            *events.lock().unwrap(),
            ["worker", "load", "served", "validate", "complete"]
        );
        assert_eq!(cache.stats().misses, 1);
        assert_eq!(cache.stats().hits, 0);
        assert_eq!(trace.closed("render.document").len(), 1);
    }
}
