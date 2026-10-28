//! The generation key follows delivered stylesheet output, not private read evidence.

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_css::compiler::Compiler;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::{Bundle, IdentityProcessor, StylesheetBundler, StylesheetRoot};
use mokly_graph::cache::MemoryCache;
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::RenderGraph;
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::DeferredFragments;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::tree::SourceTree;
use tempfile::TempDir;

/// Adds a module witness whose version changes with every bundle, like a request order would.
struct Witness {
    inner: Arc<dyn StylesheetBundler>,
    versions: Arc<AtomicUsize>,
}

impl StylesheetBundler for Witness {
    fn bundle(&self, root: &StylesheetRoot) -> mokly_css::error::Result<Bundle> {
        let mut bundle = self.inner.bundle(root)?;
        let version = self.versions.fetch_add(1, Ordering::SeqCst);
        bundle.read_evidence.insert(
            "node_modules/plugin/index.js".into(),
            ReadBaseline::Late(format!("{version:064}")),
        );
        Ok(bundle)
    }
}

fn generation_key(root: &Path, versions: &Arc<AtomicUsize>) -> String {
    let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
    let config = Loader { tree: tree.clone() }.load(root, None).unwrap();
    let prepared = Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree: tree.clone() }),
        definitions: Arc::new(DeferredDefinitions),
    }
    .prepare(&config, None)
    .unwrap();
    let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(tree));
    let graph: &dyn RenderGraph = &Graph {
        inputs: Default::default(),
        tree: tree.clone(),
        composer: Arc::new(HtmlComposer {
            fragments: Arc::new(DeferredFragments),
        }),
        stylesheets: Arc::new(Witness {
            inner: Arc::new(Compiler {
                tree: tree.clone(),
                repo_root: config.repo_root.clone(),
                resolver: Arc::new(SourceResolver {
                    settings: Default::default(),
                    tree,
                    repo_root: config.repo_root.clone(),
                }),
                processor: Arc::new(IdentityProcessor),
            }),
            versions: versions.clone(),
        }),
        cache: Arc::new(MemoryCache::new(1024 * 1024)),
        workers: Arc::new(ThreadWorkers::new(2).unwrap()),
        version: "fixture".into(),
    };
    graph
        .prepare(config, prepared, None)
        .unwrap()
        .generation_key()
        .into()
}

#[test]
fn private_read_evidence_keeps_the_generation_key_and_delivered_css_changes_it() {
    let directory = TempDir::new().unwrap();
    let root = directory.path();
    fs::create_dir_all(root.join("specs")).unwrap();
    fs::write(
        root.join("mokly.config.json"),
        r#"{"stylesheets":[{"match":"**","stylesheets":["a.css","b.css"]}]}"#,
    )
    .unwrap();
    fs::write(
        root.join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<p>Home</p>",
    )
    .unwrap();
    fs::write(root.join("a.css"), "p { color: red }").unwrap();
    fs::write(root.join("b.css"), "p { margin: 0 }").unwrap();
    let versions = Arc::new(AtomicUsize::new(0));
    let first = generation_key(root, &versions);
    let second = generation_key(root, &versions);
    assert_eq!(versions.load(Ordering::SeqCst), 4);
    assert_eq!(first, second);
    fs::write(root.join("b.css"), "p { margin: 1px }").unwrap();
    assert_ne!(generation_key(root, &versions), first);
}
