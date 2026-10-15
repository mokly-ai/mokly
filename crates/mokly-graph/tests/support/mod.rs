//! Real-tree render setup for end-to-end integration fixtures.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_css::compiler::Compiler;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::IdentityProcessor;
use mokly_graph::cache::{MemoryCache, RenderCache};
use mokly_graph::error::Result;
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::DeferredFragments;
use mokly_source_interface::tree::SourceTree;

pub fn prepare(
    root: &Path,
    bytes: usize,
    threads: usize,
) -> (Result<Arc<dyn RenderGeneration>>, Arc<dyn RenderCache>) {
    prepare_with_inputs(root, bytes, threads, Default::default())
}

pub fn prepare_with_inputs(
    root: &Path,
    bytes: usize,
    threads: usize,
    inputs: mokly_graph::delivery_inputs::DeliveryInputs,
) -> (Result<Arc<dyn RenderGeneration>>, Arc<dyn RenderCache>) {
    let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
    let config = Loader { tree: tree.clone() }.load(root, None).unwrap();
    let prepared = Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree: tree.clone() }),
        definitions: Arc::new(DeferredDefinitions),
    }
    .prepare(&config, None)
    .unwrap();
    let cache: Arc<dyn RenderCache> = Arc::new(MemoryCache::new(bytes));
    let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(tree));
    let graph: &dyn RenderGraph = &Graph {
        inputs,
        tree: tree.clone(),
        composer: Arc::new(HtmlComposer {
            fragments: Arc::new(DeferredFragments),
        }),
        stylesheets: Arc::new(Compiler {
            tree: tree.clone(),
            repo_root: config.repo_root.clone(),
            resolver: Arc::new(SourceResolver {
                settings: Default::default(),
                tree,
                repo_root: config.repo_root.clone(),
            }),
            processor: Arc::new(IdentityProcessor),
        }),
        cache: cache.clone(),
        workers: Arc::new(ThreadWorkers::new(threads).unwrap()),
        version: "fixture".into(),
    };
    (graph.prepare(config, prepared, None), cache)
}
