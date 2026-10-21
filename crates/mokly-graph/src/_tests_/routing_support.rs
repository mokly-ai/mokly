//! In-memory planning fixtures and a counter for completed routing-key work.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::CatalogueModel;
use mokly_source_interface::tree::SourceTreeMock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::graph::Graph;
use crate::key::NodeKey;
use crate::types::DocumentPlan;
use crate::workers::RenderWorkersMock;
use crate::{planning, styles};

pub(super) fn catalogue(paths: &[String]) -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: paths
                .iter()
                .map(|path| {
                    serde_json::from_value(json!({
                "metadata":{"path":path,"title":"Page","description":"","tags":[],
                    "relatedDocs":[],"isIndex":false,"rootIndex":0,
                    "source":{"path":"catalogue.mockup.ts","line":0,"column":0,"export":path}},
                "content":{"kind":"page"}
            })).unwrap()
                })
                .collect(),
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: Vec::new(),
        },
        inventory: Inventory::default(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: Vec::new(),
        warnings: Vec::new(),
    }
}

pub(super) fn plans(catalogue: &PreparedCatalogue) -> BTreeMap<String, DocumentPlan> {
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers(&|_, _| Ok("source".into())),
        RenderWorkersMock::cancelled
            .each_call(matching!())
            .returns(false),
    )));
    let graph = Graph {
        inputs: Default::default(),
        tree: mock.clone(),
        composer: mock.clone(),
        stylesheets: mock.clone(),
        cache: mock.clone(),
        workers: mock,
        version: "test".into(),
    };
    let config = ResolvedConfig {
        input: Default::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    planning::documents(
        &graph,
        &config,
        catalogue,
        &NodeKey("config".into()),
        &BTreeMap::new(),
        &styles::Matchers::new(&config).unwrap(),
        "",
    )
    .unwrap()
}
