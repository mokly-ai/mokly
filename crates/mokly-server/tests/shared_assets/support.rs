//! Real asset capture and a router whose response bodies remain under test control.

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use axum::Router;
use axum::body::Body;
use axum::http::{Method, Request};
use axum::response::Response;
use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_css::compiler::Compiler;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::IdentityProcessor;
use mokly_graph::asset_delivery::AssetRead;
use mokly_graph::cache::MemoryCache;
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::DeferredFragments;
use mokly_server::application::{Application, HttpApplication};
use mokly_server::asset_streams::{AssetStreams, TemporaryAssets};
use mokly_server::backend::GraphDocuments;
use mokly_server::clock::MonotonicClock;
use mokly_server::diagnostics::TracingDiagnostics;
use mokly_server::error::Result;
use mokly_server::preview::MemoryPreviews;
use mokly_server::public_read::OpenedFile;
use mokly_server::publication::FixedPublication;
use mokly_server::warnings::TracingWarnings;
use mokly_server::work::Workers;
use mokly_source_interface::tree::SourceTree;
use tokio::sync::watch;
use tower::ServiceExt;

use crate::support::Harness;

pub(super) const ROUTE: &str = "assets/css/opaque.svg";
pub(super) const OTHER: &str = "assets/css/other.svg";
pub(super) const LENGTH: usize = 3 * 64 * 1024;

#[derive(Default)]
pub(super) struct CountedAssets(pub(super) AtomicUsize);

impl AssetStreams for CountedAssets {
    fn capture(&self, asset: &mut dyn AssetRead, content_type: &str) -> Result<OpenedFile> {
        self.0.fetch_add(1, Ordering::SeqCst);
        TemporaryAssets.capture(asset, content_type)
    }
}

pub(super) fn payload() -> Vec<u8> {
    [
        vec![b'x'; 64 * 1024],
        vec![b'y'; 64 * 1024],
        vec![b'z'; 64 * 1024],
    ]
    .concat()
}

pub(super) fn fixture(root: &Path) {
    fs::write(root.join("css/opaque.svg"), payload()).unwrap();
    fs::write(root.join("css/other.svg"), vec![b'o'; LENGTH]).unwrap();
    let mut css = fs::read_to_string(root.join("css/base.css")).unwrap();
    css.push_str(
        "\n.opaque{background:url('./opaque.svg')}\n.other{background:url('./other.svg')}\n",
    );
    fs::write(root.join("css/base.css"), css).unwrap();
}

pub(super) fn generation(root: &Path) -> Arc<dyn RenderGeneration> {
    let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
    let config = Loader { tree: tree.clone() }.load(root, None).unwrap();
    let prepared = Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree: tree.clone() }),
        definitions: Arc::new(DeferredDefinitions),
    }
    .prepare(&config, None)
    .unwrap();
    let captured: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(tree));
    let graph = Graph {
        inputs: Default::default(),
        tree: captured.clone(),
        composer: Arc::new(HtmlComposer {
            fragments: Arc::new(DeferredFragments),
        }),
        stylesheets: Arc::new(Compiler {
            tree: captured.clone(),
            repo_root: config.repo_root.clone(),
            resolver: Arc::new(SourceResolver {
                settings: Default::default(),
                tree: captured,
                repo_root: config.repo_root.clone(),
            }),
            processor: Arc::new(IdentityProcessor),
        }),
        cache: Arc::new(MemoryCache::new(16 * 1024 * 1024)),
        workers: Arc::new(ThreadWorkers::new(2).unwrap()),
        version: "fixture".into(),
    };
    graph.prepare(config, prepared, None).unwrap()
}

pub(super) fn router(
    harness: &Harness,
    generation: Arc<dyn RenderGeneration>,
    streams: Arc<CountedAssets>,
) -> Router {
    let mut snapshot = harness.snapshot.as_ref().clone();
    Arc::make_mut(&mut snapshot.generation).documents = Arc::new(GraphDocuments::new(
        generation,
        harness.public.clone(),
        Arc::new(TracingWarnings),
        streams,
    ));
    let app = Arc::new(Application::new(
        Arc::new(FixedPublication::new(Arc::new(snapshot))),
        Arc::new(MemoryPreviews::new(
            Arc::new(MonotonicClock::default()),
            "shared-assets".into(),
        )),
        Arc::new(Workers::new(8, Arc::new(TracingDiagnostics))),
        Arc::new(TracingDiagnostics),
    ));
    app.router(watch::channel(false).1)
}

pub(super) async fn request(router: &Router, method: Method, route: &str) -> Response {
    router
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(format!("/static/mokly-generated/{route}"))
                .header("host", "127.0.0.1:4173")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
}
