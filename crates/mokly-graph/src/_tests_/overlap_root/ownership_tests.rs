//! Own roots yield once after fragment flight release; nested anchor work cannot yield.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::composition::Composed;
use mokly_html::fragment::{Fragment, FragmentRendererMock};
use mokly_html::links::Reference;
use mokly_html::parse;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::background::CompletionMock;
use crate::cache::{Artifact, MemoryCache, RenderCache};
use crate::key::NodeKey;
use crate::requests::Requests;
use crate::types::RenderGeneration;

use super::support::{catalogue, completion, document, route, session};

#[test]
fn own_root_handoff_releases_fragment_flight_and_nested_anchor_render_cannot_signal() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let anchors: Arc<Mutex<Option<Arc<dyn Requests>>>> = Arc::new(Mutex::new(None));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                let anchors = anchors.clone();
                move |_, request| {
                    calls
                        .lock()
                        .unwrap()
                        .push((request.entry_path.clone(), thread::current().id()));
                    if request.entry_path == "target" {
                        assert_eq!(anchors.lock().unwrap().as_ref().unwrap().len(), 1);
                    }
                    Ok(Fragment {
                        html: document(if request.entry_path == "caller" {
                            "<a href='mock:target#summary'>Next</a>"
                        } else {
                            "<p id=summary>Target</p>"
                        }),
                        ..Default::default()
                    })
                }
            })),
    );
    let (session, flights) = session(
        catalogue(),
        Arc::new(provider.clone()),
        Arc::new(MemoryCache::new(1 << 20, 0)),
    );
    *anchors.lock().unwrap() = Some(session.state.anchor_flights.clone());
    let handed = Arc::new(AtomicUsize::new(0));
    let completion = Unimock::new((
        CompletionMock::metadata_bytes
            .each_call(matching!())
            .returns(256_usize),
        CompletionMock::handoff
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let handed = handed.clone();
                move |_, _| {
                    assert_eq!(flights.len(), 0);
                    handed.fetch_add(1, Ordering::SeqCst);
                }
            })),
    ))
    .no_verify_in_drop();
    let artifact = session
        .render_background(&route("caller"), Arc::new(completion.clone()))
        .unwrap();
    assert!(
        String::from_utf8(artifact.bytes.clone())
            .unwrap()
            .contains("../target/index.html#summary")
    );
    let recorded = calls.lock().unwrap();
    assert_eq!(recorded.len(), 2);
    assert_eq!(recorded[0], ("caller".into(), thread::current().id()));
    assert_eq!(recorded[1].0, "target");
    assert_ne!(
        recorded[1].1,
        thread::current().id(),
        "nested completion must run on the existing render worker"
    );
    assert!(session.state.anchor_flights.is_empty());
    assert_eq!(handed.load(Ordering::SeqCst), 1);
}

#[test]
fn cached_owner_keeps_ordinary_ownership_during_nested_anchor_work_without_handoff() {
    let (completion, counts) = completion();
    let rendered = Arc::new(AtomicUsize::new(0));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let counts = counts.clone();
                let rendered = rendered.clone();
                move |_, request| {
                    assert_eq!(request.entry_path, "target");
                    assert_eq!(counts.handed.load(Ordering::SeqCst), 0);
                    assert_eq!(counts.metadata.load(Ordering::SeqCst), 0);
                    rendered.fetch_add(1, Ordering::SeqCst);
                    Ok(Fragment {
                        html: document("<p id=summary>Target</p>"),
                        ..Default::default()
                    })
                }
            })),
    );
    let cache = Arc::new(MemoryCache::new(1 << 20, 0));
    cache.insert(
        NodeKey("caller".into()),
        Arc::new(Artifact {
            bytes: document("<p>Saved</p>").into_bytes(),
            content_type: "text/html".into(),
            fragment: None,
            document: Some(Composed {
                tree: parse::html(DeliveredHtml::document(&document("<p>Saved</p>"))),
                usage: CatalogueUsage::Unavailable,
                warnings: vec![],
                resources: vec![],
                components: vec![],
                links: vec![Reference {
                    source_route: route("caller"),
                    target: "target".into(),
                    fragment: Some("summary".into()),
                }],
            }),
        }),
    );
    let (session, _) = session(catalogue(), Arc::new(provider.clone()), cache);
    session
        .render_background(&route("caller"), Arc::new(completion.clone()))
        .unwrap();
    assert_eq!(rendered.load(Ordering::SeqCst), 1);
    assert_eq!(counts.handed.load(Ordering::SeqCst), 0);
    assert_eq!(counts.metadata.load(Ordering::SeqCst), 0);
    assert!(session.state.anchor_flights.is_empty());
}
