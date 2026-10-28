//! Parallel stylesheet roots build the same generation and the same first error as serial ones.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_css::compiler::Compiler;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::{Bundle, IdentityProcessor, StylesheetBundler, StylesheetRoot};
use mokly_graph::cache::MemoryCache;
use mokly_graph::error::GraphError;
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::DeferredFragments;
use mokly_source_interface::tree::SourceTree;
use tempfile::TempDir;

mod support;

const DEADLINE: Duration = Duration::from_secs(30);

fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn fixture() -> TempDir {
    let directory = TempDir::new().unwrap();
    let root = directory.path();
    write(
        root,
        "mokly.config.json",
        r#"{"colorSchemes":["light","dark"],"stylesheets":[
            {"match":"account/**","stylesheets":["css/account.css","css/e.css"]},
            {"match":"**","stylesheets":["css/a.css","css/b.css","css/c.css","css/d.css"],
             "lightStylesheets":["css/light.css"],"darkStylesheets":["css/dark.css"]}]}"#,
    );
    write(
        root,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p class=a>Home</p>",
    );
    write(
        root,
        "specs/account/profile.screen.html",
        "---\ntitle: Profile\n---\n<p class=b>Profile</p>",
    );
    write(root, "css/shared.css", ".shared { color: red }");
    write(root, "css/nested/inner.css", ".inner { margin: 0 }");
    write(
        root,
        "css/a.css",
        "@import \"./shared.css\";\n.a { background: url('../img/dot.svg') }",
    );
    write(
        root,
        "css/b.css",
        "@import \"./shared.css\";\n.b { background: url('../img/dot.svg') }",
    );
    write(root, "css/c.css", ".c { color: blue }");
    write(
        root,
        "css/d.css",
        "@import \"./nested/inner.css\";\n.d { padding: 1px }",
    );
    write(root, "css/e.css", ".e { border: 1px solid }");
    write(
        root,
        "css/account.css",
        "@import \"./shared.css\";\n.account { gap: 2px }",
    );
    write(root, "css/light.css", ":root { color-scheme: light }");
    write(root, "css/dark.css", ":root { color-scheme: dark }");
    write(
        root,
        "img/dot.svg",
        "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
    );
    directory
}

struct Snapshot {
    key: String,
    plans: BTreeMap<String, (String, Vec<String>)>,
    resources: BTreeMap<String, String>,
    sources: Vec<String>,
    warnings: Vec<String>,
    documents: BTreeMap<String, Vec<u8>>,
}

fn snapshot(generation: &dyn RenderGeneration) -> Snapshot {
    let plans = generation
        .plans()
        .iter()
        .map(|(route, plan)| {
            (
                route.clone(),
                (plan.key.0.clone(), plan.stylesheets.clone()),
            )
        })
        .collect();
    let resources = generation
        .resource_routes()
        .into_iter()
        .map(|route| {
            let digest = generation
                .resource_digest(&format!("static/mokly-generated/{route}"))
                .unwrap()
                .unwrap();
            (route, digest)
        })
        .collect();
    let documents = generation
        .plans()
        .keys()
        .map(|route| {
            (
                route.clone(),
                generation.render(route).unwrap().bytes.clone(),
            )
        })
        .collect();
    Snapshot {
        key: generation.generation_key().into(),
        plans,
        resources,
        sources: generation.catalogue().model.sources.clone(),
        warnings: generation
            .catalogue()
            .warnings
            .iter()
            .map(|warning| format!("{warning:?}"))
            .collect(),
        documents,
    }
}

#[test]
fn parallel_and_serial_roots_build_the_same_generation() {
    let directory = fixture();
    let serial = support::prepare(directory.path(), 8 * 1024 * 1024, 1)
        .0
        .unwrap();
    let parallel = support::prepare(directory.path(), 8 * 1024 * 1024, 8)
        .0
        .unwrap();
    let (serial, parallel) = (snapshot(serial.as_ref()), snapshot(parallel.as_ref()));
    assert!(
        serial
            .resources
            .keys()
            .filter(|route| route.ends_with(".css"))
            .count()
            >= 8
    );
    assert!(
        serial
            .resources
            .keys()
            .any(|route| route.ends_with("dot.svg"))
    );
    assert_eq!(serial.key, parallel.key);
    assert_eq!(serial.plans, parallel.plans);
    assert_eq!(serial.resources, parallel.resources);
    assert_eq!(serial.sources, parallel.sources);
    assert_eq!(serial.warnings, parallel.warnings);
    assert_eq!(serial.documents, parallel.documents);
}

/// The first root in root order waits until the last root has failed.
struct LastFailsFirst {
    inner: Arc<dyn StylesheetBundler>,
    failed: Sender<()>,
    wait: Mutex<Receiver<()>>,
    timed_out: AtomicBool,
}

impl StylesheetBundler for LastFailsFirst {
    fn bundle(&self, root: &StylesheetRoot) -> mokly_css::error::Result<Bundle> {
        if root.path.ends_with("a.css") {
            let waited = self.wait.lock().unwrap().recv_timeout(DEADLINE);
            self.timed_out.store(waited.is_err(), Ordering::SeqCst);
            return self.inner.bundle(root);
        }
        let result = self.inner.bundle(root);
        if root.path.ends_with("z.css") {
            self.failed.send(()).unwrap();
        }
        result
    }
}

#[test]
fn the_first_failed_root_in_root_order_gives_the_error_when_a_later_root_fails_first() {
    let directory = TempDir::new().unwrap();
    let root = directory.path();
    write(
        root,
        "mokly.config.json",
        r#"{"stylesheets":[{"match":"**","stylesheets":["css/a.css","css/m.css","css/z.css"]}]}"#,
    );
    write(
        root,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p>",
    );
    write(root, "css/a.css", "@import \"./missing-a.css\";");
    write(root, "css/m.css", ".m { color: red }");
    write(root, "css/z.css", "@import \"./missing-z.css\";");
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
    let (failed, wait) = mpsc::channel();
    let stylesheets = Arc::new(LastFailsFirst {
        inner: Arc::new(Compiler {
            tree: tree.clone(),
            repo_root: config.repo_root.clone(),
            resolver: Arc::new(SourceResolver {
                settings: Default::default(),
                tree: tree.clone(),
                repo_root: config.repo_root.clone(),
            }),
            processor: Arc::new(IdentityProcessor),
        }),
        failed,
        wait: Mutex::new(wait),
        timed_out: AtomicBool::new(false),
    });
    let graph: &dyn RenderGraph = &Graph {
        inputs: Default::default(),
        tree,
        composer: Arc::new(HtmlComposer {
            fragments: Arc::new(DeferredFragments),
        }),
        stylesheets: stylesheets.clone(),
        cache: Arc::new(MemoryCache::new(1024 * 1024)),
        workers: Arc::new(ThreadWorkers::new(3).unwrap()),
        version: "fixture".into(),
    };
    let Err(error) = graph.prepare(config, prepared, None) else {
        panic!("expected a stylesheet failure")
    };
    assert!(!stylesheets.timed_out.load(Ordering::SeqCst));
    let GraphError::Css { source } = &error else {
        panic!("expected a CSS error, got {error:?}")
    };
    let message = source.to_string();
    assert!(message.contains("missing-a.css"), "{message}");
    assert!(!message.contains("missing-z.css"), "{message}");
}
