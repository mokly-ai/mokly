//! Real graph fixture with controlled resource edits and captured observer events.

use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_cli::serve::PreparedServe;
use mokly_graph::cache::MemoryCache;
use mokly_graph::graph::Graph;
use mokly_graph::types::RenderGraph;
use mokly_graph::workers::RenderWorkersMock;
use mokly_html::composition::{Composed, ComposerMock};
use mokly_html::parse;
use mokly_model::usage::CatalogueUsage;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use mokly_watch::error::Error;
use mokly_watch::event::{Event, Kind};
use mokly_watch::observer::ObserverMock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::serve_watch::WatchedInputs;
use crate::serve_watch::serve_watch_tests::{catalogue, prepared, watch};

pub(super) struct Fixture {
    pub(super) watch: Arc<WatchedInputs>,
    pub(super) graph: Graph,
    pub(super) prepared: PreparedServe,
    pub(super) catalogue: PreparedCatalogue,
    pub(super) edited: Arc<AtomicBool>,
    pub(super) renders: Arc<AtomicUsize>,
}

pub(super) fn fixture(fail_first: bool) -> Fixture {
    let attached = Arc::new(AtomicBool::new(false));
    let failing = Arc::new(AtomicBool::new(fail_first));
    let edited = Arc::new(AtomicBool::new(false));
    let events = Arc::new(Mutex::new(Vec::new()));
    let renders = Arc::new(AtomicUsize::new(0));
    let observer = Unimock::new((
        ObserverMock::observes.each_call(matching!(_)).returns(true),
        ObserverMock::resource
            .each_call(matching!((path) if *path == Path::new("/repo/assets/new.svg")))
            .answers_arc(Arc::new({
                let attached = attached.clone();
                move |_, _| {
                    if failing.swap(false, Ordering::SeqCst) {
                        return Err(Error::Rescan);
                    }
                    attached.store(true, Ordering::SeqCst);
                    Ok(())
                }
            }))
            .at_least_times(0),
        ObserverMock::replace
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let attached = attached.clone();
                move |_, plan| {
                    if plan.exact.contains_key(Path::new("/repo/assets/new.svg")) {
                        attached.store(true, Ordering::SeqCst);
                    }
                    Ok(())
                }
            })),
        ObserverMock::take
            .each_call(matching!())
            .answers_arc(Arc::new({
                let events = events.clone();
                move |_| std::mem::take(&mut *events.lock().unwrap())
            })),
    ));
    let watch = watch(Arc::new(observer), Unimock::new(()));
    let mut prepared = prepared("specs", Unimock::new(()));
    let mut catalogue = catalogue();
    catalogue.model.entries = vec![
        serde_json::from_value(json!({
            "metadata": {"path":"page", "title":"Page", "description":"", "tags":[],
                "relatedDocs":[], "isIndex":false, "rootIndex":0,
                "source":{"path":"specs/page.page.tsx", "line":1, "column":1}},
            "content":{"kind":"page"}
        }))
        .unwrap(),
    ];
    catalogue.model.sources = vec!["specs/page.page.tsx".into()];
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let attached = attached.clone();
                let edited = edited.clone();
                let events = events.clone();
                move |_, path| {
                    if path != Path::new("/repo/assets/new.svg") {
                        return Ok("source".into());
                    }
                    let before = !edited.swap(true, Ordering::SeqCst);
                    if before && attached.load(Ordering::SeqCst) {
                        events.lock().unwrap().push(Ok(Event {
                            path: path.into(),
                            kind: Kind::File,
                        }));
                    }
                    Ok(if before { "before-edit" } else { "after-edit" }.into())
                }
            })),
    )));
    let graph = Graph {
        inputs: Default::default(), tree,
        composer: Arc::new(Unimock::new(
            ComposerMock::compose.each_call(matching!(_)).answers_arc(Arc::new({
                let renders = renders.clone(); move |_, _| {
                    renders.fetch_add(1, Ordering::SeqCst);
                    Ok(Composed {
                        tree: parse::html(DeliveredHtml::document("<html><head></head><body><img src='../../assets/new.svg'></body></html>")),
                        usage: CatalogueUsage::Unavailable, resources: vec![], components: vec![], warnings: vec![], links: vec![],
                    })
                }
            })),
        )),
        stylesheets: Arc::new(Unimock::new(())),
        cache: Arc::new(MemoryCache::new(1024 * 1024, 0)),
        workers: Arc::new(Unimock::new((
            RenderWorkersMock::stylesheets.each_call(matching!(_, _)).answers(&|_, _, _| Ok(vec![])),
            RenderWorkersMock::cancelled.each_call(matching!()).returns(false),
            RenderWorkersMock::document.each_call(matching!(_, _)).answers(&|_, route, worker| worker.artifact(route)),
        ))),
        version: "test".into(),
    };
    prepared.generation = graph
        .prepare(prepared.config.clone(), catalogue.clone(), None)
        .unwrap();
    Fixture {
        watch,
        graph,
        prepared,
        catalogue,
        edited,
        renders,
    }
}
