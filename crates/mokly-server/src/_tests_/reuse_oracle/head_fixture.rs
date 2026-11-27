//! Real HTML generations over one in-memory repository, as Serve wraps them for Changes.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_reuse::{
    ComparisonReuse, MemoryComparisons, ReuseAttempt, ReuseFence,
};
use mokly_compare::comparison_types::ComparisonRequest;
use mokly_compare::error::Error;
use mokly_compare::moves::Detector;
use mokly_css::compiler::Compiler;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::IdentityProcessor;
use mokly_graph::background::BackgroundRead;
use mokly_graph::delivery_inputs::DeliveryInputs;
use mokly_graph::error::GraphError;
use mokly_graph::graph::Graph;
use mokly_graph::key::NodeKey;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::{ComposeRequest, Composed, Composer, HtmlComposer};
use mokly_html::error::{self, HtmlError};
use mokly_html::fragment::DeferredFragments;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_source_interface::tree::SourceTree;
use unimock::Unimock;

use crate::comparison_graph::FrozenResources;

use super::head_tree::{CountingCache, MemoryTree, ROOT};

pub(super) const BADGE: &str = "---\nelement: kit-badge\ntitle: Badge\npropSchema:\n  type: object\n  additionalProperties: false\n  properties:\n    label: { type: string }\nprops:\n  label: Badge\n---\n<span class=\"badge\">{{label}}</span>";
pub(super) const HOME: &str = "---\ntitle: Home\n---\n<h1 id=\"top\">Home</h1><img src=\"../../icon.svg\"><a href=\"mock:target#summary\">Target</a><kit-badge label=\"One\"></kit-badge><button><span to=\"target\">Go</span></button>";
pub(super) const TARGET: &str =
    "---\ntitle: Target\n---\n<h1 id=\"summary\">Target</h1><kit-badge label=\"Two\"></kit-badge>";
pub(super) const OTHER: &str = "---\ntitle: Other\n---\n<p>Other</p>";

/// Seeds a renderer stylesheet for Home, and fails the render of a view titled Broken.
struct Renderer;

impl Composer for Renderer {
    fn compose(&self, request: &ComposeRequest<'_>) -> error::Result<Composed> {
        if request.entry.metadata.title == "Broken" {
            return Err(HtmlError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Render,
                    message: "Broken threw while rendering".into(),
                },
            });
        }
        let mut document = HtmlComposer {
            fragments: Arc::new(DeferredFragments),
        }
        .compose(request)?;
        if request.entry.metadata.path == "home" {
            document.resources.push("seed.css".into());
        }
        Ok(document)
    }
}

/// One source state: the session the background pass reads, and its Changes wrapper.
pub(super) struct State {
    pub(super) inner: Arc<dyn RenderGeneration>,
    pub(super) head: Arc<dyn RenderGeneration>,
}

pub(super) struct Fixture {
    pub(super) tree: Arc<MemoryTree>,
    pub(super) cache: Arc<CountingCache>,
    inputs: DeliveryInputs,
}

impl Fixture {
    pub(super) fn new() -> Self {
        let tree = Arc::new(MemoryTree::default());
        tree.write("mokly.config.json", "{}");
        tree.write("specs/badge.component.html", BADGE);
        tree.write("specs/home.screen.html", HOME);
        tree.write("specs/target.screen.html", TARGET);
        tree.write("specs/other.screen.html", OTHER);
        tree.write("icon.svg", "<svg><title>one</title></svg>");
        tree.write("seed.css", "p{color:red}");
        Self {
            tree,
            cache: CountingCache::new(),
            inputs: DeliveryInputs::default(),
        }
    }

    pub(super) fn state(&self) -> State {
        let source: Arc<dyn SourceTree> = self.tree.clone();
        let root = Path::new(ROOT);
        let config = Loader {
            tree: source.clone(),
        }
        .load(root, Some("mokly.config.json"))
        .unwrap();
        let catalogue = Builder {
            tree: source.clone(),
            discovery: Arc::new(Discoverer {
                tree: source.clone(),
            }),
            definitions: Arc::new(Unimock::new(())),
        }
        .prepare(&config, None)
        .unwrap();
        let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(source));
        let graph: &dyn RenderGraph = &Graph {
            inputs: self.inputs.clone(),
            tree: tree.clone(),
            composer: Arc::new(Renderer),
            stylesheets: Arc::new(Compiler {
                tree: tree.clone(),
                repo_root: config.repo_root.clone(),
                resolution: Default::default(),
                resolver: Arc::new(SourceResolver {
                    settings: Default::default(),
                    tree,
                    repo_root: config.repo_root.clone(),
                }),
                processor: Arc::new(IdentityProcessor),
            }),
            cache: self.cache.clone(),
            workers: Arc::new(ThreadWorkers::new(2).unwrap()),
            version: "head-reuse-test".into(),
        };
        let inner = graph.prepare(config, catalogue, None).unwrap();
        State {
            head: Arc::new(FrozenResources::new(inner.clone())),
            inner,
        }
    }
}

impl State {
    /// Read each route whose document key the previous state did not have, and each page and
    /// Markdown document, as the pass does: only views complete, so the pass reads a route
    /// without a viewport again after each edit.
    pub(super) fn pass(&self, previous: Option<&State>) -> Vec<String> {
        let known: BTreeMap<_, _> = previous
            .map(|state| {
                state
                    .inner
                    .plans()
                    .iter()
                    .map(|(route, plan)| (route.clone(), plan.key.clone()))
                    .collect()
            })
            .unwrap_or_default();
        let routes: Vec<_> = self
            .inner
            .plans()
            .iter()
            .filter(|(route, plan)| plan.viewport.is_none() || known.get(*route) != Some(&plan.key))
            .map(|(route, _)| route.clone())
            .collect();
        self.background(&routes)
    }

    /// Complete the background reads of these routes and return the ones that succeeded.
    pub(super) fn background(&self, routes: &[String]) -> Vec<String> {
        routes
            .iter()
            .filter(|route| match self.inner.read_background(route) {
                Ok(Some(BackgroundRead::Complete(_)) | None) => true,
                Ok(Some(BackgroundRead::Miss(miss))) => miss.complete(None).is_ok(),
                Err(_) => false,
            })
            .cloned()
            .collect()
    }

    /// The document key of one route.
    pub(super) fn key(&self, route: &str) -> NodeKey {
        self.inner.plans()[route].key.clone()
    }
}

/// Entries with a cache insert in the reuse attempt: a checked read or a comparison read.
/// A failed render inserts nothing, and a view validated from kept facts inserts nothing.
pub(super) fn read(state: &State, fixture: &Fixture) -> BTreeSet<String> {
    let inserts = fixture.cache.take_inserts();
    let catalogue = state.inner.catalogue();
    state
        .inner
        .plans()
        .values()
        .filter(|plan| inserts.contains_key(&plan.key))
        .map(|plan| catalogue.model.entries[plan.entry].metadata.path.clone())
        .collect()
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

/// Failure messages by route and the attempt's warnings, as the diagnostics report them.
pub(super) fn failure(error: &Error) -> (Vec<String>, Vec<(String, String, String)>) {
    let Error::Graph { source } = error else {
        return (vec![error.to_string()], vec![]);
    };
    let messages = match source {
        GraphError::Attempt { failures, .. } => failures.iter().map(ToString::to_string).collect(),
        other => vec![other.to_string()],
    };
    let warnings = source
        .warnings()
        .iter()
        .map(|warning| {
            (
                warning.code.into(),
                warning.printed_subject(),
                warning.message.clone(),
            )
        })
        .collect();
    (messages, warnings)
}
