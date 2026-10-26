//! In-memory catalogue with counted composition and no artifact retention.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::composition::{Composed, ComposerMock};
use mokly_html::parse;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry};
use mokly_model::usage::CatalogueUsage;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::cache::RenderCacheMock;
use crate::delivery_inputs::DeliveryInputs;
use crate::graph::Graph;
use crate::key::NodeKey;
use crate::resource_inputs::ResourceInputsMock;
use crate::session::{Session, SessionInput};
use crate::styles::Matchers;
use crate::types::DocumentPlan;
use crate::workers::RenderWorkersMock;

pub(super) struct Probe {
    pub(super) session: Session,
    pub(super) renders: Arc<Mutex<Vec<String>>>,
    pub(super) options: Arc<Mutex<Options>>,
    pub(super) cancelled: Arc<AtomicBool>,
}

#[derive(Default)]
pub(super) struct Options {
    pub(super) invalid: BTreeSet<String>,
    pub(super) cross_link: bool,
    pub(super) cancel_on: Option<String>,
}

pub(super) fn warning(path: &str) -> Warning {
    Warning {
        code: "base-dependencies",
        subject: WarningSubject::Entry(path.into()),
        message: format!("warning {path}"),
    }
}

pub(super) fn probe(count: usize) -> Probe {
    let renders = Arc::new(Mutex::new(Vec::new()));
    let recorded = renders.clone();
    let options = Arc::new(Mutex::new(Options::default()));
    let authored = options.clone();
    let cancelled = Arc::new(AtomicBool::new(false));
    let trigger = cancelled.clone();
    let check = cancelled.clone();
    let mock = Arc::new(Unimock::new((
        ResourceInputsMock::retain.each_call(matching!(_)).returns(()),
        ResourceInputsMock::release.each_call(matching!(_)).returns(()),
        ResourceInputsMock::paths.each_call(matching!(_)).returns(BTreeMap::new()),
        RenderWorkersMock::run.each_call(matching!(_, _)).answers(&|_, routes, worker| routes.iter().map(|route| worker.validate(route)).collect()).at_least_times(0),
        RenderWorkersMock::cancelled.each_call(matching!()).answers_arc(Arc::new(move |_| check.load(Ordering::SeqCst))).at_least_times(0),
        RenderWorkersMock::comparison_parallelism.each_call(matching!()).returns(2_usize),
        ComposerMock::compose.each_call(matching!(_)).answers_arc(Arc::new(move |_, request| {
            let path = &request.entry.metadata.path;
            recorded.lock().unwrap().push(path.clone());
            let options = authored.lock().unwrap();
            if options.cancel_on.as_ref() == Some(path) { trigger.store(true, Ordering::SeqCst); }
            let content = if options.invalid.contains(path) { "<a href='#missing'>Invalid</a>" }
                else if options.cross_link && path == "page-000" { "<a href='mock:page-003#missing'>Target</a>" }
                else { "" };
            Ok(Composed {
                tree: parse::html(DeliveredHtml::document(&format!("<!doctype html><html><head><title>{path}</title></head><body><p id=anchor>{path}</p>{content}</body></html>"))),
                usage: CatalogueUsage::Unavailable, warnings: vec![warning(path)], resources: vec![], components: vec![], links: vec![],
            })
        })),
        RenderCacheMock::get.each_call(matching!(_)).returns(None),
        RenderCacheMock::insert.each_call(matching!(_, _)).returns(()),
    )));
    let graph = Graph {
        inputs: DeliveryInputs {
            resources: mock.clone(),
            ..Default::default()
        },
        tree: mock.clone(),
        composer: mock.clone(),
        stylesheets: mock.clone(),
        cache: mock.clone(),
        workers: mock.clone(),
        version: "test".into(),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![],
    };
    let entries = (0..count).map(|index| {
        let path = format!("page-{index:03}");
        ModelEntry { metadata: serde_json::from_value(json!({"path":path,"title":path,"description":"","tags":[],"relatedDocs":[],"isIndex":false,"rootIndex":0,"source":{"path":format!("{path}.page.html"),"line":1,"column":1}})).unwrap(), content: EntryContent::Page }
    }).collect();
    let catalogue = PreparedCatalogue {
        model: CatalogueModel {
            entries,
            folders: vec![],
            sources: vec![],
            color_schemes: vec![ColorScheme::Light],
        },
        inventory: Default::default(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: vec![],
        warnings: vec![warning("preparation")],
    };
    let plans = (0..count)
        .map(|entry| {
            let route = format!("page-{entry:03}/index.html");
            (
                route.clone(),
                DocumentPlan {
                    resource_key: route.clone(),
                    key: NodeKey(route.clone()),
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
    let session = Session::new(
        &graph,
        SessionInput {
            config,
            catalogue,
            plans,
            resources: BTreeMap::new(),
            policy: mock,
            generation_key: "test".into(),
            matchers,
            directories: vec![],
        },
    );
    Probe {
        session,
        renders,
        options,
        cancelled,
    }
}
