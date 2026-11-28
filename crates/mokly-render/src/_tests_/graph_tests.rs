//! Definition module paths reach stylesheet preparation without truncation.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::render_sources::{
    JavaScriptCatalogue, JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};
use mokly_css::error::CssError;
use mokly_graph::error::GraphError;
use mokly_graph::types::GraphFactory;
use mokly_graph::workers::RenderWorkersMock;
use mokly_model::catalogue::CatalogueModel;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTreeMock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::runtime::Runtime;

#[test]
fn hash_in_module_path_keeps_its_stylesheet_root_and_reports_route_error() {
    let tree = Arc::new(Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
    ));
    let runtime = Runtime::new(
        tree.clone(),
        tree,
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            PoolMock::request
                .some_call(matching!(Call::Bindings(_)))
                .returns(Ok(MethodResult::Empty)),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new((
            RenderWorkersMock::comparison_tasks
                .some_call(matching!(_, _))
                .answers(&|_, count, task| {
                    for index in 0..count {
                        task.run(index);
                    }
                }),
            RenderWorkersMock::cancelled
                .each_call(matching!())
                .returns(false),
            RenderWorkersMock::stylesheets
                .some_call(matching!(_, _))
                .answers(&|_, roots, worker| {
                    assert_eq!(
                        roots
                            .iter()
                            .map(|root| root.path.as_str())
                            .collect::<Vec<_>>(),
                        ["src/c#/card.tsx"]
                    );
                    assert_eq!(roots[0].stylesheets, ["styles/card.css"]);
                    roots.iter().map(|root| worker.stylesheet(root)).collect()
                }),
        ))),
        "test".into(),
        None,
    );
    let config = ResolvedConfig {
        input: Default::default(),
        modules: Default::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let catalogue = PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![
                serde_json::from_value(json!({
                    "metadata": {
                        "path": "card", "title": "Card", "description": "", "tags": [],
                        "relatedDocs": [], "isIndex": false, "rootIndex": 0,
                        "source": {"path": "src/c#/card.tsx", "export": "Card", "line": 1, "column": 1}
                    },
                    "content": {"kind": "page"}
                }))
                .unwrap(),
            ],
            folders: Vec::new(),
            sources: vec!["src/c#/card.tsx".into()],
            color_schemes: Vec::new(),
        },
        javascript: JavaScriptCatalogue {
            bindings: BTreeMap::from([(
                "src/c#/card.tsx#Card".into(),
                ResolvedDefinition {
                    path: "card".into(),
                    title: "Card".into(),
                },
            )]),
            entries: BTreeMap::from([(
                "card".into(),
                RenderSource {
                    handle: "src/c#/card.tsx#Card".into(),
                    method: RenderMethod::Page,
                    slots: BTreeMap::new(),
                    stylesheets: Vec::new(),
                    content_slots: None,
                },
            )]),
            generation: Some(JavaScriptGeneration {
                id: "generation".into(),
                modules: BTreeMap::from([(
                    "src/c#/card.tsx".into(),
                    vec!["styles/card.css".into()],
                )]),
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
        warnings: Vec::new(),
    };
    let factory: &dyn GraphFactory = &runtime;
    let result = factory
        .create(&config)
        .unwrap()
        .prepare(config, catalogue, None);
    let GraphError::Attempt { failures, .. } = result.err().expect("invalid CSS root must fail")
    else {
        panic!("expected a graph attempt failure");
    };
    let [
        GraphError::Css {
            source: CssError::RootRoute { path },
        },
    ] = failures.as_slice()
    else {
        panic!("expected the CSS root route error, got {failures:?}");
    };
    assert_eq!(path, "src/c#/card.tsx");
}
