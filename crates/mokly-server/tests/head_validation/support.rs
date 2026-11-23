//! Real HTML graphs and comparisons with independent source generations.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_reuse::{
    ComparisonReuse, MemoryComparisons, ReuseAttempt, ReuseFence,
};
use mokly_compare::comparison_types::{ComparisonRequest, ComparisonResult};
use mokly_compare::moves::Detector;
use mokly_css::compiler::Compiler;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::IdentityProcessor;
use mokly_graph::cache::{MemoryCache, RenderCache};
use mokly_graph::delivery_inputs::DeliveryInputs;
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::{Composer, HtmlComposer};
use mokly_html::fragment::DeferredFragments;
use mokly_server::comparison_graph::FrozenResources;
use mokly_source_interface::tree::SourceTree;
use serde_json::{Value, json};
use tempfile::TempDir;
use unimock::Unimock;

pub(super) const HOME: &str = "---\ntitle: Home\n---\n<h1>Home</h1><img src=\"../../icon.svg\">";

pub(super) struct Fixture {
    pub(super) root: TempDir,
    pub(super) inputs: DeliveryInputs,
    pub(super) cache: Arc<dyn RenderCache>,
}

impl Fixture {
    pub(super) fn new() -> Self {
        let fixture = Self {
            root: tempfile::tempdir().unwrap(),
            inputs: DeliveryInputs::default(),
            cache: Arc::new(MemoryCache::new(4 * 1024 * 1024, 0)),
        };
        fixture.write("mokly.config.json", "{}");
        fixture.write("specs/home.screen.html", HOME);
        fixture.write(
            "specs/target.screen.html",
            "---\ntitle: Target\n---\n<h1 id=\"summary\">Target</h1>",
        );
        fixture.write("icon.svg", "<svg><title>one</title></svg>");
        fixture
    }

    pub(super) fn write(&self, path: &str, content: &str) {
        let path = self.root.path().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    pub(super) fn generation(&self) -> Arc<dyn RenderGeneration> {
        self.with_tree(Arc::new(WorkingTree))
    }

    pub(super) fn with_tree(&self, tree: Arc<dyn SourceTree>) -> Arc<dyn RenderGeneration> {
        self.with_composer(
            tree,
            Arc::new(HtmlComposer {
                fragments: Arc::new(DeferredFragments),
            }),
        )
    }

    pub(super) fn with_composer(
        &self,
        tree: Arc<dyn SourceTree>,
        composer: Arc<dyn Composer>,
    ) -> Arc<dyn RenderGeneration> {
        prepare(
            self.root.path(),
            tree,
            self.cache.clone(),
            self.inputs.clone(),
            composer,
        )
    }
}

fn prepare(
    root: &Path,
    tree: Arc<dyn SourceTree>,
    cache: Arc<dyn RenderCache>,
    inputs: DeliveryInputs,
    composer: Arc<dyn Composer>,
) -> Arc<dyn RenderGeneration> {
    let config = Loader { tree: tree.clone() }.load(root, None).unwrap();
    let catalogue = Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree: tree.clone() }),
        definitions: Arc::new(Unimock::new(())),
    }
    .prepare(&config, None)
    .unwrap();
    let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(tree));
    let graph: &dyn RenderGraph = &Graph {
        inputs,
        tree: tree.clone(),
        composer,
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
        workers: Arc::new(ThreadWorkers::new(2).unwrap()),
        version: "head-validation-test".into(),
    };
    Arc::new(FrozenResources::new(
        graph.prepare(config, catalogue, None).unwrap(),
    ))
}

pub(super) fn engine() -> Engine {
    Engine {
        moves: Arc::new(Detector),
        css: Arc::new(MemoryParsedCss::new(1024 * 1024)),
    }
}

pub(super) fn request() -> ComparisonRequest {
    ComparisonRequest {
        base_ref: "base".into(),
        base_commit: "b".repeat(40),
        catalogue_identity: "c".repeat(64),
    }
}

pub(super) fn attempt(store: &MemoryComparisons) -> Arc<dyn ReuseAttempt> {
    store.begin(engine(), ReuseFence::new(&"settings"))
}

pub(super) fn output(result: &ComparisonResult) -> Value {
    json!({
        "review": result.review, "snapshot": result.snapshot,
        "counts": [result.counts.changes, result.counts.moved, result.counts.ignored_only],
        "warnings": result.warnings.iter().map(|warning| (warning.code, warning.printed_subject(), &warning.message)).collect::<Vec<_>>(),
        "entries": result.entries.iter().map(|entry| json!({"kind": entry.kind, "path": entry.path, "previous": entry.previous_path, "state": entry.state, "included": entry.included, "reasons": entry.reasons, "views": entry.documents.iter().map(|view| json!({"before":view.before_route,"after":view.after_route,"state":view.state,"evidence":view.evidence,"ignored":view.ignored_ids})).collect::<Vec<_>>() })).collect::<Vec<_>>()
    })
}
