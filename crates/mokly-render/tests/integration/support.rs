//! Isolated fixture consumers and captured real-sidecar requests.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder, PreparedCatalogue};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::cache::MemoryCache;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_graph::workers::ThreadWorkers;
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::runtime::Runtime;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;
use tempfile::TempDir;

use super::process_counts::{CountedFactory, ProcessCounts};

#[path = "../../../../tests/rust/package_version.rs"]
pub(super) mod package_version;

#[derive(Default)]
struct Reporter(Mutex<Vec<String>>);
impl Diagnostics for Reporter {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
        self.0.lock().unwrap().push(message.into());
    }
}

pub(super) struct CapturedPool {
    pub(super) inner: Arc<dyn SidecarPool>,
    pub(super) calls: Mutex<Vec<Call>>,
}

impl SidecarPool for CapturedPool {
    fn request(&self, call: Call) -> mokly_sidecar::error::Result<MethodResult> {
        self.calls.lock().unwrap().push(call.clone());
        self.inner.request(call)
    }
    fn abort(&self) -> mokly_sidecar::error::Result<()> {
        self.inner.abort()
    }
    fn shutdown(&self) -> mokly_sidecar::error::Result<()> {
        self.inner.shutdown()
    }
}

pub(super) struct Consumer {
    pub(super) directory: TempDir,
    pub(super) runtime: Arc<Runtime>,
    pub(super) pool: Arc<CapturedPool>,
    pub(super) processes: Arc<ProcessCounts>,
}

impl Consumer {
    pub(super) fn new() -> Self {
        let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .unwrap();
        let directory = tempfile::tempdir().unwrap();
        copy(
            &workspace.join("tests/fixtures/javascript"),
            directory.path(),
        );
        #[cfg(unix)]
        std::os::unix::fs::symlink(
            workspace.join("node_modules"),
            directory.path().join("node_modules"),
        )
        .unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(
            workspace.join("node_modules"),
            directory.path().join("node_modules"),
        )
        .unwrap();
        let clock = Arc::new(SystemClock::new());
        let processes = Arc::new(ProcessCounts::default());
        let pool = Arc::new(CapturedPool {
            calls: Mutex::new(Vec::new()),
            inner: Arc::new(Pool::new(
                Arc::new(CountedFactory {
                    inner: Arc::new(NodeFactory::new(
                        Arc::new(SystemProcessGroups),
                        clock.clone(),
                        Arc::new(Reporter::default()),
                        Arc::new(SystemMemory),
                    )),
                    counts: processes.clone(),
                }),
                clock,
                Launch {
                    node: "node".into(),
                    entry: workspace.join("packages/mokly/dist/sidecar.js"),
                    repository: directory.path().into(),
                    version: package_version::read(),
                },
                PoolOptions {
                    size: 2.try_into().unwrap(),
                    timeout_ms: None,
                },
            )),
        });
        let runtime = Arc::new(Runtime::new(
            Arc::new(WorkingTree),
            Arc::new(WorkingTree),
            pool.clone(),
            Arc::new(MemoryCache::new(16 * 1024 * 1024)),
            Arc::new(ThreadWorkers::new(2).unwrap()),
            package_version::read(),
            None,
        ));
        Self {
            directory,
            runtime,
            pool,
            processes,
        }
    }

    pub(super) fn root(&self) -> &Path {
        self.directory.path()
    }

    pub(super) fn config(&self) -> ResolvedConfig {
        let loader: &dyn ConfigLoader = &Loader {
            tree: Arc::new(WorkingTree),
        };
        loader.load(self.root(), None).unwrap()
    }

    pub(super) fn prepare(&self) -> mokly_catalogue::error::Result<PreparedCatalogue> {
        let builder: &dyn CatalogueBuilder = &Builder {
            tree: Arc::new(WorkingTree),
            discovery: Arc::new(Discoverer {
                tree: Arc::new(WorkingTree),
            }),
            definitions: self.runtime.clone(),
        };
        builder.prepare(&self.config(), None)
    }

    pub(super) fn generation(&self, prepared: PreparedCatalogue) -> Arc<dyn RenderGeneration> {
        let factory: &dyn GraphFactory = self.runtime.as_ref();
        factory
            .create(&self.config())
            .unwrap()
            .prepare(self.config(), prepared, None)
            .unwrap()
    }

    pub(super) fn replace(&self, path: &str, from: &str, to: &str) {
        let path = self.root().join(path);
        let text = fs::read_to_string(&path).unwrap();
        assert!(
            text.contains(from),
            "fixture must contain replacement target {from:?}"
        );
        fs::write(path, text.replace(from, to)).unwrap();
    }
}

impl Drop for Consumer {
    fn drop(&mut self) {
        self.pool.shutdown().unwrap();
    }
}

fn copy(source: &Path, destination: &Path) {
    fs::create_dir_all(destination).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let target = destination.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).unwrap();
        }
    }
}
