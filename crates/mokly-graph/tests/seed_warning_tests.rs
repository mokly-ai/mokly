//! A renderer stylesheet seed warns in on-demand renders and in the build summary.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_css::compiler::Compiler;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::IdentityProcessor;
use mokly_graph::cache::MemoryCache;
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::{ComposeRequest, Composed, Composer, HtmlComposer};
use mokly_html::error::Result as HtmlResult;
use mokly_html::fragment::DeferredFragments;
use mokly_source_interface::tree::SourceTree;

const ROUTE: &str = "home/index.mobile.html";

/// Composes like the core and adds one renderer seed that names a stylesheet.
struct SeedingComposer {
    inner: HtmlComposer,
}

impl Composer for SeedingComposer {
    fn compose(&self, request: &ComposeRequest<'_>) -> HtmlResult<Composed> {
        let mut composed = self.inner.compose(request)?;
        composed.resources.push("specs/theme.css".into());
        Ok(composed)
    }
}

fn generation(root: &Path) -> Arc<dyn RenderGeneration> {
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
        cache: Arc::new(MemoryCache::new(16 * 1024 * 1024)),
        workers: Arc::new(ThreadWorkers::new(1).unwrap()),
        version: "fixture".into(),
    };
    graph.prepare(config, prepared, None).unwrap()
}

fn catalogue() -> tempfile::TempDir {
    catalogue_with("<main><h1>Home</h1></main>")
}

fn catalogue_with(body: &str) -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(
        root.path().join("mokly.config.json"),
        r#"{ "roots": [{ "dir": "specs" }] }"#,
    )
    .unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        format!("---\ntitle: Home\n---\n\n{body}\n"),
    )
    .unwrap();
    fs::write(
        root.path().join("specs/theme.css"),
        "body { color: red; }\n",
    )
    .unwrap();
    root
}

fn seed_warnings(warnings: &[Warning]) -> Vec<&Warning> {
    warnings
        .iter()
        .filter(|warning| warning.code == "stylesheet-owner")
        .collect()
}

#[test]
fn an_on_demand_render_reports_the_seed_warning_once() {
    let root = catalogue();
    let generation = generation(root.path());
    for _ in 0..2 {
        let artifact = generation.render(ROUTE).unwrap();
        let warnings = &artifact.document.as_ref().unwrap().warnings;
        let seeds = seed_warnings(warnings);
        assert_eq!(seeds.len(), 1, "{warnings:?}");
        assert!(seeds[0].message.contains("\"specs/theme.css\""));
    }
}

#[test]
fn the_build_summary_reports_the_seed_warning_for_each_view() {
    let root = catalogue();
    let summary = generation(root.path()).render_all().unwrap();
    let seeds = seed_warnings(&summary.warnings);
    assert!(!seeds.is_empty(), "{:?}", summary.warnings);
    assert!(
        seeds
            .iter()
            .any(|warning| warning.printed_subject() == ROUTE)
    );
}

#[test]
fn a_props_preview_reports_the_seed_warning_once() {
    let root = catalogue();
    let preview = generation(root.path())
        .render_props(ROUTE, &Default::default())
        .unwrap();
    let warnings = &preview.artifact.document.as_ref().unwrap().warnings;
    assert_eq!(seed_warnings(warnings).len(), 1, "{warnings:?}");
}

#[test]
fn a_failed_link_check_keeps_the_seed_warning() {
    let root = catalogue_with(r#"<main><a href="mock:home#missing">Home</a></main>"#);
    let Err(error) = generation(root.path()).render(ROUTE) else {
        panic!("the missing fragment must fail the render");
    };
    let warnings = error.warnings();
    assert_eq!(seed_warnings(&warnings).len(), 1, "{warnings:?}");
}
