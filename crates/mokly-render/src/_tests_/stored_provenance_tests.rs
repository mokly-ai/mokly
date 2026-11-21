//! Graph store hits preserve the physical side root when generation ids match.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::render_sources::{
    JavaScriptCatalogue, JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_graph::cache::{Artifact, MemoryCache};
use mokly_graph::document_store::{DocumentStoreMock, ReadOutcome};
use mokly_graph::types::GraphFactory;
use mokly_graph::workers::RenderWorkersMock;
use mokly_html::composition::Composed;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::usage::CatalogueUsage;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTreeMock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::runtime::Runtime;
use crate::side::BaseSide;

#[test]
fn a_base_store_hit_with_the_head_generation_keeps_its_extraction_root() {
    let roots = Arc::new(Mutex::new(Vec::new()));
    for base in [false, true] {
        let tree = Arc::new(Unimock::new(
            SourceTreeMock::read
                .each_call(matching!(_))
                .answers(&|_, _| Ok(b"export default page".to_vec())),
        ));
        let captured = roots.clone();
        let pool = Unimock::new((
            PoolMock::request.some_call(matching!(Call::Bindings(_))).returns(Ok(MethodResult::Empty)),
            PoolMock::record_served_render.some_call(matching!(_, _)).answers_arc(
                Arc::new(move |_, root, call| {
                    assert_eq!(serde_json::to_value(call).unwrap(), json!({
                        "method":"renderPage","params":{"generation":"g","handle":"entry.tsx#Entry"}
                    }));
                    captured.lock().unwrap().push(root.to_path_buf());
                })),
        ));
        let saved = Arc::new(Artifact {
            bytes: b"stored page".to_vec(),
            content_type: "text/html".into(),
            fragment: None,
            document: Some(Composed {
                tree: vec![],
                usage: CatalogueUsage::Ready {
                    instances: vec![],
                    slots: vec![],
                    ranges: vec![],
                },
                warnings: vec![],
                resources: vec![],
                components: vec![],
                links: vec![],
            }),
        });
        let document = saved.clone();
        let store = Unimock::new((
            DocumentStoreMock::identity
                .each_call(matching!())
                .returns(Some("native".into())),
            DocumentStoreMock::load
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| ReadOutcome::Hit(document.clone()))),
        ));
        let workers = Unimock::new((
            RenderWorkersMock::cancelled
                .each_call(matching!())
                .returns(false),
            RenderWorkersMock::comparison_tasks
                .some_call(matching!(_, _))
                .answers(&|_, count, task| {
                    for index in 0..count {
                        task.run(index);
                    }
                }),
            RenderWorkersMock::stylesheets
                .some_call(matching!(_, _))
                .returns(Ok(vec![])),
        ));
        let side = base.then(|| {
            Arc::new(BaseSide {
                working_root: "/head".into(),
                sources: Arc::new(Lease {
                    directory: "/cache/base".into(),
                    guard: Box::new(Unimock::new(())),
                }),
                dependencies: Resolved {
                    tier: Tier::Working,
                    node_modules: "/head/node_modules".into(),
                    module_resolution: Default::default(),
                    warning: None,
                    lease: None,
                    repository_roots: vec!["/head".into()],
                },
                cache_namespace: None,
                identity: "base".into(),
            })
        });
        let dependencies = if base {
            Unimock::new(())
        } else {
            Unimock::new(
                SourceTreeMock::project
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(None)),
            )
        };
        let runtime = Runtime::new(
            tree.clone(),
            Arc::new(dependencies.clone()),
            Arc::new(Unimock::new(())),
            Arc::new(pool.clone()),
            Arc::new(MemoryCache::new(1024 * 1024, 0)),
            Arc::new(workers.clone()),
            "test".into(),
            side,
        )
        .with_document_store(Arc::new(store.clone()));
        let config = ResolvedConfig {
            input: Default::default(),
            modules: Default::default(),
            file: "/head/mokly.config.json".into(),
            repo_root: "/head".into(),
            authored_inputs: vec![],
            roots: vec![],
        };
        let catalogue = PreparedCatalogue {
            model: CatalogueModel {
                entries: vec![
                    serde_json::from_value(json!({
                        "metadata":{"path":"page","title":"Page","description":"","tags":[],
                            "relatedDocs":[],"isIndex":false,"rootIndex":0,
                            "source":{"path":"entry.tsx","export":"Entry","line":1,"column":1}},
                        "content":{"kind":"page"}
                    }))
                    .unwrap(),
                ],
                folders: vec![],
                sources: vec!["entry.tsx".into()],
                color_schemes: vec![],
            },
            javascript: JavaScriptCatalogue {
                entries: BTreeMap::from([(
                    "page".into(),
                    RenderSource {
                        handle: "entry.tsx#Entry".into(),
                        method: RenderMethod::Page,
                        ..Default::default()
                    },
                )]),
                bindings: BTreeMap::from([(
                    "entry.tsx#Entry".into(),
                    ResolvedDefinition {
                        path: "page".into(),
                        title: "Page".into(),
                    },
                )]),
                generation: Some(JavaScriptGeneration {
                    id: "g".into(),
                    persistence_identity: Some("js".into()),
                    modules: BTreeMap::from([("entry.tsx".into(), vec![])]),
                    ..Default::default()
                }),
            },
            inventory: Default::default(),
            templates: BTreeMap::new(),
            documents: BTreeMap::new(),
            slot_fragments: BTreeMap::new(),
            elements: BTreeMap::new(),
            prop_validators: BTreeMap::new(),
            dependency_directories: Default::default(),
            warnings: vec![],
        };
        let factory: &dyn GraphFactory = &runtime;
        let generation = factory
            .create(&config)
            .unwrap()
            .prepare(config, catalogue, None)
            .unwrap();
        assert_eq!(
            generation
                .comparison_document("page/index.html")
                .unwrap()
                .bytes,
            saved.bytes
        );
    }
    assert_eq!(
        *roots.lock().unwrap(),
        [
            std::path::PathBuf::from("/head"),
            std::path::PathBuf::from("/cache/base")
        ]
    );
}
