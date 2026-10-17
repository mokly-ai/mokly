//! Real native graph and local HTTP fixture for end-to-end delivery checks.

use std::collections::BTreeMap;
use std::fs;
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
use mokly_graph::cache::MemoryCache;
use mokly_graph::graph::Graph;
use mokly_graph::policy::FilePolicy;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::DeferredFragments;
use mokly_server::application::Application;
use mokly_server::assets::File;
use mokly_server::backend::GraphDocuments;
use mokly_server::clock::MonotonicClock;
use mokly_server::preview::MemoryPreviews;
use mokly_server::public_read::ConfinedReader;
use mokly_server::publication::SharedPublication;
use mokly_server::runtime::{ServerRuntime, TokioServer};
use mokly_server::shutdown::FixedLifecycle;
use mokly_server::snapshot::{Projector, Snapshot, SnapshotFactory, SnapshotInput};
use mokly_server::warnings::TracingWarnings;
use mokly_server::work::Workers;
use mokly_source_interface::tree::SourceTree;
use tempfile::TempDir;
use tokio::sync::watch;

pub struct Harness {
    pub root: TempDir,
    pub generation: Arc<dyn RenderGeneration>,
    pub snapshot: Arc<Snapshot>,
    pub publications: Arc<SharedPublication>,
    pub url: String,
    pub client: reqwest::Client,
    stop: watch::Sender<bool>,
    handle: tokio::task::JoinHandle<mokly_server::error::Result<()>>,
}

pub fn copy(source: &Path, destination: &Path) {
    fs::create_dir_all(destination).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        if entry.file_type().unwrap().is_dir() {
            copy(&entry.path(), &destination.join(entry.file_name()));
        } else {
            fs::copy(entry.path(), destination.join(entry.file_name())).unwrap();
        }
    }
}

impl Harness {
    pub async fn new() -> Self {
        Self::with_lifecycle(Arc::new(FixedLifecycle)).await
    }
    pub async fn with_lifecycle(lifecycle: Arc<dyn mokly_server::shutdown::Lifecycle>) -> Self {
        Self::with_fixture(lifecycle, |_| {}).await
    }
    pub async fn with_edit(edit: fn(&Path)) -> Self {
        Self::with_fixture(Arc::new(FixedLifecycle), edit).await
    }
    async fn with_fixture(
        lifecycle: Arc<dyn mokly_server::shutdown::Lifecycle>,
        edit: fn(&Path),
    ) -> Self {
        let root = TempDir::new().unwrap();
        copy(
            &Path::new(env!("CARGO_MANIFEST_DIR")).join("../mokly-graph/tests/fixtures/catalogue"),
            root.path(),
        );
        edit(root.path());
        let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
        let config = Loader { tree: tree.clone() }
            .load(root.path(), None)
            .unwrap();
        let prepared = Builder {
            tree: tree.clone(),
            discovery: Arc::new(Discoverer { tree: tree.clone() }),
            definitions: Arc::new(DeferredDefinitions),
        }
        .prepare(&config, None)
        .unwrap();
        let captured: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(tree.clone()));
        let graph: &dyn RenderGraph = &Graph {
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
        let generation = graph.prepare(config.clone(), prepared, None).unwrap();
        let mut assets = BTreeMap::new();
        for (path, content_type) in [
            ("client/shell.js", "text/javascript; charset=utf-8"),
            ("client/inspector.js", "text/javascript; charset=utf-8"),
            ("shell.css", "text/css; charset=utf-8"),
            ("fonts/InterVariable.woff2", "font/woff2"),
            ("client/brand.svg", "image/svg+xml"),
        ] {
            assets.insert(
                format!("mokly-viewer/{path}"),
                File {
                    bytes: b"fixture".to_vec().into(),
                    content_type: content_type.into(),
                },
            );
        }
        let policy = FilePolicy::new(
            tree,
            &config,
            &generation.catalogue().model.sources,
            Default::default(),
            None,
        )
        .unwrap();
        let docs = Arc::new(GraphDocuments::new(
            generation.clone(),
            Arc::new(ConfinedReader {
                repo_root: config.repo_root,
                policy: Arc::new(policy),
            }),
            Arc::new(TracingWarnings),
        ));
        let projector: &dyn SnapshotFactory = &Projector {
            deployment_id: "a".repeat(64),
            render_token: "b".repeat(64),
        };
        let snapshot = projector
            .create(
                generation.clone(),
                SnapshotInput {
                    documents: docs,
                    revision: 1,
                    config_path: "mokly.config.json".into(),
                    base: None,
                    assets,
                },
            )
            .unwrap();
        let publications = Arc::new(SharedPublication::new(snapshot.clone()));
        let app = Arc::new(Application::new(
            publications.clone(),
            Arc::new(MemoryPreviews::new(
                Arc::new(MonotonicClock::default()),
                "test-secret".into(),
            )),
            Arc::new(Workers::new(
                2,
                Arc::new(mokly_server::diagnostics::TracingDiagnostics),
            )),
            Arc::new(mokly_server::diagnostics::TracingDiagnostics),
        ));
        let runtime: &dyn ServerRuntime = &TokioServer;
        let server = runtime.bind(0).await.unwrap();
        let url = format!("http://{}", server.address());
        let (stop, receiver) = watch::channel(false);
        let handle = tokio::spawn(server.run(app, receiver, lifecycle));
        Self {
            root,
            generation,
            snapshot,
            publications,
            url,
            client: reqwest::Client::new(),
            stop,
            handle,
        }
    }
    pub async fn close(self) {
        self.close_result().await.unwrap();
    }
    pub async fn close_result(self) -> mokly_server::error::Result<()> {
        self.stop.send_replace(true);
        self.handle.await.unwrap()
    }
}

pub fn headers(response: &reqwest::Response) {
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert_eq!(response.headers()["x-content-type-options"], "nosniff");
    assert!(
        response
            .headers()
            .get("access-control-allow-origin")
            .is_none()
    );
}
