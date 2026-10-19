//! Anchor checks share bounded destination artifacts without skipping any view.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::composition::{Composed, ComposerMock};
use mokly_html::diagnostic_code::Code;
use mokly_html::links::Reference;
use mokly_html::parse;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::CatalogueModel;
use mokly_model::usage::CatalogueUsage;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::cache::{Artifact, RenderCacheMock};
use crate::delivery_inputs::DeliveryInputs;
use crate::error::GraphError;
use crate::graph::Graph;
use crate::key::NodeKey;
use crate::resource_inputs::ResourceInputsMock;
use crate::session::{Session, SessionInput};
use crate::styles::Matchers;
use crate::types::DocumentPlan;
use crate::validation;

pub(super) struct Probe {
    pub(super) session: Session,
    compositions: Arc<AtomicUsize>,
    reads: Arc<AtomicUsize>,
    artifacts: Arc<Mutex<BTreeMap<NodeKey, Arc<Artifact>>>>,
}

pub(super) fn probe(retain: bool, missing_dark_mobile: bool) -> Probe {
    let compositions = Arc::new(AtomicUsize::new(0));
    let renders = compositions.clone();
    let reads = Arc::new(AtomicUsize::new(0));
    let lookups = reads.clone();
    let artifacts = Arc::new(Mutex::new(BTreeMap::<NodeKey, Arc<Artifact>>::new()));
    let read = artifacts.clone();
    let write = artifacts.clone();
    let mock = Arc::new(Unimock::new((
        ResourceInputsMock::retain
            .each_call(matching!(_))
            .returns(()),
        ResourceInputsMock::release
            .each_call(matching!(_))
            .returns(()),
        ResourceInputsMock::paths
            .each_call(matching!(_))
            .returns(BTreeMap::new()),
        ComposerMock::compose
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                renders.fetch_add(1, Ordering::SeqCst);
                let missing = missing_dark_mobile
                    && request.viewport == Viewport::Mobile
                    && request.color_scheme == ColorScheme::Dark;
                Ok(Composed {
                    tree: parse::document(if missing {
                        "<h1>No anchor</h1>"
                    } else {
                        "<h1 id=summary>Target</h1>"
                    }),
                    usage: CatalogueUsage::Unavailable,
                    warnings: vec![],
                    resources: vec![],
                    components: vec![],
                    links: vec![],
                })
            })),
        RenderCacheMock::get
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| {
                lookups.fetch_add(1, Ordering::SeqCst);
                read.lock().unwrap().get(key).cloned()
            })),
        RenderCacheMock::insert
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, key, artifact| {
                if retain {
                    write.lock().unwrap().insert(key, artifact);
                }
            })),
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
    let entry = |path, content| {
        serde_json::from_value(json!({
            "metadata":{"path":path,"title":"Target","description":"","tags":[],
                "relatedDocs":[],"isIndex":false,"rootIndex":0,
                "source":{"path":"target.mockup.tsx","line":1,"column":1}},
            "content":content
        }))
        .unwrap()
    };
    let catalogue = PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![
                entry(
                    "target",
                    json!({"kind":"screen","useCasePaths":[],"visual":{
                        "colorSchemes":["light","dark"],"props":{},"controls":{},
                        "propSchema":{"type":"object","properties":{}}
                    }}),
                ),
                entry(
                    "journey",
                    json!({"kind":"use-case","steps":[{"screenPath":"target"}]}),
                ),
            ],
            folders: vec![],
            sources: vec![],
            color_schemes: vec![ColorScheme::Light, ColorScheme::Dark],
        },
        inventory: Inventory::default(),
        javascript: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: vec![],
        warnings: vec![],
    };
    let mut plans = BTreeMap::new();
    for (viewport, name) in [(Viewport::Mobile, "mobile"), (Viewport::Desktop, "desktop")] {
        for (color_scheme, suffix) in [(ColorScheme::Light, ""), (ColorScheme::Dark, ".dark")] {
            let route = format!("target/index.{name}{suffix}.html");
            plans.insert(
                route.clone(),
                DocumentPlan {
                    resource_key: route.clone(),
                    key: NodeKey(route.clone()),
                    route,
                    entry: 0,
                    viewport: Some(viewport),
                    color_scheme,
                    stylesheets: vec![],
                },
            );
        }
    }
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
        compositions,
        reads,
        artifacts,
    }
}

fn reference(target: &str, fragment: &str) -> Reference {
    Reference {
        source_route: "caller/index.desktop.html".into(),
        target: target.into(),
        fragment: Some(fragment.into()),
    }
}

#[test]
fn shared_destinations_render_once_for_eight_and_thirty_two_anchor_checks() {
    let run = |count| {
        let probe = probe(true, false);
        for index in 0..count {
            let target = if index % 2 == 0 { "target" } else { "journey" };
            validation::links(&probe.session, &[reference(target, "summary")]).unwrap();
        }
        assert_eq!(probe.compositions.load(Ordering::SeqCst), 4);
        let artifacts = probe.artifacts.lock().unwrap();
        assert_eq!(artifacts.len(), 4);
        for artifact in artifacts.values() {
            assert!(String::from_utf8_lossy(&artifact.bytes).contains("id=\"summary\""));
        }
        probe.reads.load(Ordering::SeqCst)
    };
    let small = run(8);
    assert!(small > 0);
    assert_eq!(run(32), 4 * small);
}

#[test]
fn a_cache_that_retains_nothing_still_validates_every_requested_view() {
    let probe = probe(false, false);
    for _ in 0..2 {
        validation::links(&probe.session, &[reference("target", "summary")]).unwrap();
    }
    assert_eq!(probe.compositions.load(Ordering::SeqCst), 8);
    assert!(probe.artifacts.lock().unwrap().is_empty());
}

#[test]
fn a_cached_destination_does_not_make_a_missing_fragment_valid() {
    let probe = probe(true, false);
    validation::links(&probe.session, &[reference("target", "summary")]).unwrap();
    let error = validation::links(&probe.session, &[reference("target", "absent")]).unwrap_err();
    let GraphError::Invalid {
        code,
        route,
        message,
    } = error
    else {
        panic!("expected invalid fragment")
    };
    assert_eq!(code, Code::BuildInvalid);
    assert_eq!(route, "caller/index.desktop.html");
    assert_eq!(
        message,
        "caller/index.desktop.html: logical fragment \"absent\" is missing from target/index.desktop.dark.html"
    );
    assert_eq!(probe.compositions.load(Ordering::SeqCst), 4);
    assert!(
        probe
            .session
            .state
            .anchor_flights
            .lock()
            .unwrap()
            .is_empty()
    );
}

#[test]
fn an_anchor_missing_from_one_destination_view_still_fails() {
    let probe = probe(true, true);
    let error = validation::links(&probe.session, &[reference("journey", "summary")]).unwrap_err();
    let GraphError::Invalid {
        code,
        route,
        message,
    } = error
    else {
        panic!("expected invalid fragment")
    };
    assert_eq!(code, Code::BuildInvalid);
    assert_eq!(route, "caller/index.desktop.html");
    assert_eq!(
        message,
        "caller/index.desktop.html: logical fragment \"summary\" is missing from target/index.mobile.dark.html"
    );
    assert!(
        probe
            .session
            .state
            .anchor_flights
            .lock()
            .unwrap()
            .is_empty()
    );
}
