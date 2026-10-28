//! Two sides that share one render cache keep their own closure warnings.

use std::fs;
use std::path::{Path, PathBuf};
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
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::{ComposeRequest, Composed, Composer, HtmlComposer};
use mokly_html::error::Result as HtmlResult;
use mokly_html::fragment::DeferredFragments;
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::{Child, Node, SourceTree};

const ROUTE: &str = "home/index.mobile.html";

/// Composes like the core and seeds one image, as a renderer's resources do. Planning
/// does not see a seed, so both sides keep equal document keys.
struct SeedingComposer {
    inner: HtmlComposer,
}

impl Composer for SeedingComposer {
    fn compose(&self, request: &ComposeRequest<'_>) -> HtmlResult<Composed> {
        let mut composed = self.inner.compose(request)?;
        composed.resources.push("specs/logo.png".into());
        Ok(composed)
    }
}

/// A base tree whose checkout conversion cannot supply one public file.
struct Unconverted {
    missing: PathBuf,
}

impl SourceTree for Unconverted {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        WorkingTree.project(path)
    }
    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        WorkingTree.children(path)
    }
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        if path == self.missing {
            return Err(SourceError::Unavailable {
                path: path.into(),
                message: "the base checkout filter could not supply logo.png".into(),
            });
        }
        WorkingTree.read(path)
    }
}

fn generation(
    root: &Path,
    tree: Arc<dyn SourceTree>,
    cache: Arc<dyn RenderCache>,
) -> Arc<dyn RenderGeneration> {
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
        composer: Arc::new(SeedingComposer {
            inner: HtmlComposer {
                fragments: Arc::new(DeferredFragments),
            },
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
        cache,
        workers: Arc::new(ThreadWorkers::new(1).unwrap()),
        version: "fixture".into(),
    };
    graph.prepare(config, prepared, None).unwrap()
}

fn catalogue() -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(
        root.path().join("mokly.config.json"),
        r#"{ "roots": [{ "dir": "specs" }] }"#,
    )
    .unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n\n<main><h1>Home</h1></main>\n",
    )
    .unwrap();
    fs::write(root.path().join("specs/logo.png"), b"\x89PNG fixture").unwrap();
    root
}

fn conversion_warnings(generation: &dyn RenderGeneration) -> usize {
    let artifact = generation.render(ROUTE).unwrap();
    artifact
        .document
        .as_ref()
        .unwrap()
        .warnings
        .iter()
        .filter(|warning| warning.code == "base-conversion")
        .count()
}

#[test]
fn a_base_only_conversion_warning_never_reaches_the_head() {
    let head_root = catalogue();
    let base_root = catalogue();
    let cache: Arc<dyn RenderCache> = Arc::new(MemoryCache::new(16 * 1024 * 1024));
    let head = generation(head_root.path(), Arc::new(WorkingTree), cache.clone());
    let loaded = Loader {
        tree: Arc::new(WorkingTree),
    }
    .load(base_root.path(), None)
    .unwrap();
    let base = generation(
        base_root.path(),
        Arc::new(Unconverted {
            missing: loaded.repo_root.join("specs/logo.png"),
        }),
        cache,
    );
    assert_eq!(head.plans()[ROUTE].key, base.plans()[ROUTE].key);
    assert_eq!(conversion_warnings(head.as_ref()), 0);
    assert_eq!(conversion_warnings(base.as_ref()), 1);
    assert_eq!(conversion_warnings(head.as_ref()), 0);
    assert_eq!(conversion_warnings(base.as_ref()), 1);
}
