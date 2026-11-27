//! A real HTML composer and memoized fragments with mocked source boundaries.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::render_sources::{JavaScriptGeneration, RenderMethod, RenderSource};
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::FragmentRenderer;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::routes;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::background::{BackgroundRead, Completion, CompletionMock};

use crate::cache::{Artifact, RenderCache};
use crate::delivery_inputs::DeliveryInputs;
use crate::error::{InternalError, Result};
use crate::fragments::MemoFragments;
use crate::graph::Graph;
use crate::key::NodeKey;
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::render_inputs::RenderKeys;
use crate::requests::{MemoryRequests, Requests};
use crate::session::{Session, SessionInput};
use crate::styles::Matchers;
use crate::types::{DocumentPlan, RenderGeneration};
use crate::workers::ThreadWorkers;

pub(super) fn background(
    session: &Session,
    route: &str,
    completion: Arc<dyn Completion>,
) -> Result<Arc<Artifact>> {
    match session.read_background(route)? {
        Some(BackgroundRead::Complete(artifact)) => Ok(artifact),
        Some(BackgroundRead::Miss(miss)) => miss.complete(Some(completion)),
        None => Err(InternalError::PreparedRootConsumed.into()),
    }
}

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
                stylesheet_imports: Default::default(),
                stylesheet_resolution_files: Default::default(),
                stylesheet_resolution_roots: Default::default(),
            },
        ),
        flights,
    )
}

pub(super) fn persistent_catalogue() -> PreparedCatalogue {
    let mut catalogue = catalogue();
    catalogue.javascript.generation = Some(JavaScriptGeneration {
        id: "background-generation".into(),
        ..Default::default()
    });
    catalogue.javascript.entries.insert(
        "caller".into(),
        RenderSource {
            handle: "caller.recipe#page".into(),
            method: RenderMethod::Page,
            ..Default::default()
        },
    );
    catalogue
}

pub(super) fn observe_validation(
    session: &mut Session,
    in_worker: Arc<AtomicBool>,
    events: Arc<Mutex<Vec<&'static str>>>,
) {
    let boundaries = Arc::new(
        Unimock::new((
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, _| {
                    Ok(Some(Node {
                        identity: "/repo/asset.bin".into(),
                        lexical_kind: FileKind::File,
                        kind: FileKind::File,
                    }))
                }),
            SourceTreeMock::digest
                .each_call(matching!(_))
                .answers(&|_, _| Ok("current-asset-digest".into())),
            PublicPolicyMock::check
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, path| {
                    assert_eq!(path, "asset.bin");
                    assert!(in_worker.load(Ordering::SeqCst));
                    events.lock().unwrap().push("validate");
                    Ok(PublicFile {
                        path: "asset.bin".into(),
                        absolute: "/repo/asset.bin".into(),
                    })
                })),
        ))
        .no_verify_in_drop(),
    );
    let state = Arc::get_mut(&mut session.state).unwrap();
    state.tree = boundaries.clone();
    state.policy = boundaries;
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
