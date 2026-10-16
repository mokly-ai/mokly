//! Preparation stops at explicit entry and stylesheet boundaries in event order.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::types::{Bundle, StylesheetBundlerMock};
use mokly_model::catalogue::{CatalogueModel, ModelEntry};
use mokly_model::runtime_diagnostic::RuntimeCode;
use mokly_source_interface::tree::SourceTreeMock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::cache::RenderCacheMock;
use crate::error::GraphError;
use crate::graph::Graph;
use crate::key::NodeKey;
use crate::types::RenderGraph;
use crate::workers::RenderWorkersMock;
use crate::{planning, styles};

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    }
}

fn catalogue(paths: &[&str]) -> PreparedCatalogue {
    let entries: Vec<ModelEntry> = paths
        .iter()
        .map(|path| {
            serde_json::from_value(json!({
                "metadata":{"path":path,"title":"Page","description":"","tags":[],
                    "relatedDocs":[],"isIndex":false,"rootIndex":0,
                    "source":{"path":"page.mockup.ts","line":0,"column":0,"export":"page"}},
                "content":{"kind":"page"}
            }))
            .unwrap()
        })
        .collect();
    PreparedCatalogue {
        model: CatalogueModel {
            entries,
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: Vec::new(),
        },
        inventory: Inventory::default(),
        javascript: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: Vec::new(),
        warnings: Vec::new(),
    }
}

fn graph(mock: Unimock) -> Graph {
    let mock = Arc::new(mock);
    Graph {
        inputs: Default::default(),
        tree: mock.clone(),
        composer: mock.clone(),
        stylesheets: mock.clone(),
        cache: mock.clone(),
        workers: mock,
        version: "test".into(),
    }
}

#[test]
fn planning_checks_each_entry_even_when_exports_share_a_source() {
    let graph = graph(Unimock::new((
        RenderWorkersMock::cancelled
            .next_call(matching!())
            .returns(false),
        SourceTreeMock::digest
            .next_call(matching!((path) if *path == Path::new("/repo/page.mockup.ts")))
            .returns(Ok("source-digest".into())),
        RenderWorkersMock::cancelled
            .next_call(matching!())
            .returns(false),
        RenderWorkersMock::cancelled
            .next_call(matching!())
            .returns(false),
        RenderWorkersMock::cancelled
            .next_call(matching!())
            .returns(true),
    )));
    let config = config();
    let error = planning::documents(
        &graph,
        &config,
        &catalogue(&["first", "styles/second"]),
        &NodeKey("config".into()),
        &BTreeMap::new(),
        &styles::Matchers::new(&config).unwrap(),
        "",
    )
    .unwrap_err();
    assert_cancelled(error);
}

#[test]
fn preparation_stops_before_the_next_stylesheet_root() {
    let graph = graph(Unimock::new((
        RenderWorkersMock::cancelled
            .next_call(matching!())
            .returns(false),
        StylesheetBundlerMock::bundle
            .next_call(matching!((root) if root.path == "a.css"))
            .returns(Ok(Bundle {
                route: "styles/a.css".into(),
                css: "p {}".into(),
                assets: Default::default(),
                css_modules: Default::default(),
                inputs: Default::default(),
                imported_by: Default::default(),
                repository_aliases: Default::default(),
                dependency_digests: Default::default(),
                plugin_inputs: Default::default(),
                directories: Vec::new(),
            })),
        RenderCacheMock::insert
            .next_call(matching!(_, _))
            .returns(()),
        RenderWorkersMock::cancelled
            .next_call(matching!())
            .returns(true),
    )));
    let mut config = config();
    config.input = serde_json::from_value(
        json!({"stylesheets":[{"match":"**","stylesheets":["a.css","b.css"]}]}),
    )
    .unwrap();
    let error = graph.prepare(config, catalogue(&[]), None).err().unwrap();
    assert_cancelled(error);
}

fn assert_cancelled(error: GraphError) {
    let GraphError::Runtime { source } = error else {
        panic!("{error}")
    };
    assert_eq!(source.code, RuntimeCode::Cancelled);
    assert_eq!(source.message, "build cancelled");
}
