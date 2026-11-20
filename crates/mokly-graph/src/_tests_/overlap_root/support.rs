//! A real HTML composer and memoized fragments with mocked source boundaries.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::FragmentRenderer;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::routes;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::background::CompletionMock;

use crate::cache::RenderCache;
use crate::delivery_inputs::DeliveryInputs;
use crate::fragments::MemoFragments;
use crate::graph::Graph;
use crate::key::NodeKey;
use crate::render_inputs::RenderKeys;
use crate::requests::{MemoryRequests, Requests};
use crate::session::{Session, SessionInput};
use crate::styles::Matchers;
use crate::types::DocumentPlan;
use crate::workers::ThreadWorkers;

pub(super) fn route(path: &str) -> String {
    routes::document(path, ColorScheme::Light)
}

pub(super) fn document(body: &str) -> String {
    format!(
        "<!doctype html><html lang=\"en\"><head><title>Test</title></head><body>{body}</body></html>"
    )
}

pub(super) fn catalogue() -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel { entries: ["caller", "target"].into_iter().map(|path| serde_json::from_value(json!({
            "metadata":{"path":path,"title":"Test","description":"","tags":[],"relatedDocs":[],"isIndex":false,"rootIndex":0,
                "source":{"path":format!("{path}.mockup.tsx"),"export":"default","line":1,"column":1}},
            "content":{"kind":"page"}
        })).unwrap()).collect(), folders: vec![], sources: vec![], color_schemes: vec![ColorScheme::Light] },
        inventory: Inventory::default(), javascript: Default::default(), dependency_directories: Default::default(),
        templates: BTreeMap::new(), documents: BTreeMap::new(), slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(), prop_validators: Default::default(), warnings: vec![],
    }
}

pub(super) fn session(
    catalogue: PreparedCatalogue,
    renderer: Arc<dyn FragmentRenderer>,
    cache: Arc<dyn RenderCache>,
) -> (Session, Arc<dyn Requests>) {
    let flights: Arc<dyn Requests> = Arc::new(MemoryRequests::default());
    let fragments = MemoFragments {
        keys: Arc::new(RenderKeys::whole(NodeKey("inputs".into()))),
        renderer,
        cache: cache.clone(),
        flights: flights.clone(),
    };
    let graph = Graph {
        inputs: DeliveryInputs::default(),
        tree: Arc::new(Unimock::new(())),
        composer: Arc::new(HtmlComposer {
            fragments: Arc::new(fragments),
        }),
        stylesheets: Arc::new(Unimock::new(())),
        cache,
        workers: Arc::new(ThreadWorkers::new(1).unwrap()),
        version: "test".into(),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: vec![],
        roots: vec![],
    };
    let plans = catalogue
        .model
        .entries
        .iter()
        .enumerate()
        .map(|(entry, model)| {
            let route = route(&model.metadata.path);
            (
                route.clone(),
                DocumentPlan {
                    key: NodeKey(model.metadata.path.clone()),
                    resource_key: model.metadata.path.clone(),
                    route,
                    entry,
                    viewport: None,
                    color_scheme: ColorScheme::Light,
                    stylesheets: vec![],
                },
            )
        })
        .collect();
    let matchers = Matchers::new(&config).unwrap();
    (
        Session::new(
            &graph,
            SessionInput {
                config,
                catalogue,
                plans,
                resources: BTreeMap::new(),
                policy: Arc::new(Unimock::new(())),
                generation_key: "test".into(),
                matchers,
                directories: vec![],
            },
        ),
        flights,
    )
}

#[derive(Default)]
pub(super) struct CompletionCounts {
    pub(super) entered: AtomicUsize,
    pub(super) handed: AtomicUsize,
    pub(super) metadata: AtomicUsize,
    pub(super) bytes: AtomicUsize,
}

pub(super) fn completion() -> (Unimock, Arc<CompletionCounts>) {
    completion_with(true)
}

pub(super) fn refusing() -> (Unimock, Arc<CompletionCounts>) {
    completion_with(false)
}

fn completion_with(accept: bool) -> (Unimock, Arc<CompletionCounts>) {
    let counts = Arc::new(CompletionCounts::default());
    let mock = Unimock::new((
        CompletionMock::enter
            .each_call(matching!())
            .answers_arc(Arc::new({
                let counts = counts.clone();
                move |_| {
                    counts.entered.fetch_add(1, Ordering::SeqCst);
                }
            })),
        CompletionMock::handoff
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let counts = counts.clone();
                move |_, bytes| {
                    counts.bytes.store(bytes, Ordering::SeqCst);
                    if accept {
                        counts.handed.fetch_add(1, Ordering::SeqCst);
                    } else {
                        counts.entered.fetch_add(1, Ordering::SeqCst);
                    }
                }
            })),
        CompletionMock::metadata_bytes
            .each_call(matching!())
            .answers_arc(Arc::new({
                let counts = counts.clone();
                move |_| {
                    counts.metadata.fetch_add(1, Ordering::SeqCst);
                    256
                }
            })),
    ))
    .no_verify_in_drop();
    (mock, counts)
}
